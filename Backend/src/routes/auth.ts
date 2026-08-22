import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import * as Sentry from '@sentry/node';
import { User, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  registerSchema,
  loginSchema,
  deleteAccountSchema,
  verifyEmailSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../schemas/authSchemas';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET,
  FACEBOOK_CALLBACK_URL,
  SUPER_ADMIN_EMAILS,
} from '../utils/env';
import { sendVerificationEmail, sendPasswordResetEmail, sendBusinessVerifiedEmail, sendPayoutIbanChangedEmail } from '../services/emailService';
import { uploadToBunnyStorage, isBunnyStorageConfigured, BunnyStorageUploadError, deleteBunnyStorageUrlIfManaged } from '../services/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
import { parseBusinessDocument, isBusinessKycParsingConfigured, shouldAutoApprove } from '../services/businessKycService';

const router = Router();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Same fallback pattern as payments.ts/emailService.ts/certificateService.ts.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// Tighter, dedicated budget for /login specifically — the one endpoint an
// actual credential-stuffing/brute-force script would hit directly, as
// opposed to authRateLimit below which just needs to stop casual abuse of
// the other unauthenticated endpoints.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait before trying again.',
});

// Shared budget for the other unauthenticated, credential-adjacent
// endpoints (registration, password reset, email verification, OAuth token
// exchange) — same in-memory/IP-keyed limiter as everywhere else in this
// app (see middleware/rateLimit.ts), just a looser cap than loginRateLimit
// since none of these is a single guessable secret to brute-force.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please try again shortly.',
});
// GitHub/Facebook redirect_uri construction lives in utils/env.ts
// (GITHUB_CALLBACK_URL/FACEBOOK_CALLBACK_URL) so it shares BACKEND_URL's
// single source of truth and https-forcing safety net with the rest of the
// app, instead of redeclaring the same fallback logic here.

// GitHub/Facebook's redirect-based OAuth flow round-trips through the
// provider, so the CSRF "state" param can't be verified against anything
// held in server memory across that gap without a session store. Instead
// it's a short-lived, self-verifying signed token (reusing JWT_SECRET) —
// forging one requires the same secret that protects every session token,
// and it expires in 10 minutes. Also carries the student/business role
// choice through the round trip, since GitHub/Facebook have no equivalent
// of the request-body `role` field Google's client-side flow gets to use.
function signOauthState(role?: 'Student' | 'Client'): string {
  return jwt.sign({ role, purpose: 'oauth-state' }, JWT_SECRET, { expiresIn: '10m' });
}
function verifyOauthState(state: string): { role?: 'Student' | 'Client' } {
  const payload = jwt.verify(state, JWT_SECRET) as { role?: 'Student' | 'Client'; purpose?: string };
  if (payload.purpose !== 'oauth-state') throw new Error('Invalid state token.');
  return { role: payload.role };
}

// Only the SHA-256 hash of a password-reset token is ever persisted — the
// raw token exists only in the emailed link and the requester's browser.
// A DB read (backup leak, injection, etc.) on its own can't be turned into
// a working reset link this way, the same defense-in-depth pattern as
// storing bcrypt hashes of passwords rather than the passwords themselves.
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Auto-promotes accounts on the SUPER_ADMIN_EMAILS allow-list (see
// utils/env.ts) — checked on every register/login/Google sign-in so it takes
// effect immediately whichever path the account first appears through, and
// keeps re-asserting it (idempotent) in case admin rights were ever revoked
// by mistake. Also auto-verifies their email — SUPER_ADMIN_EMAILS is an
// explicit allow-list the operator controls, so there's no one else's inbox
// this could leak access to; the point of email verification (proving you
// own the address) is moot for an address that's already hardcoded as
// trusted. No-op (returns the user unchanged) if the email isn't listed or
// the account already has everything applied.
async function maybePromoteSuperAdmin(user: User): Promise<User> {
  if (!SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) return user;
  if (
    user.adminRole === 'SUPER_ADMIN' &&
    user.role === 'SuperAdmin' &&
    user.status === 'APPROVED' &&
    user.emailVerifiedAt
  ) {
    return user;
  }
  return prisma.user.update({
    where: { id: user.id },
    data: {
      adminRole: 'SUPER_ADMIN',
      role: 'SuperAdmin',
      status: 'APPROVED',
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
}

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isVerifiedGraduate: boolean;
  isHrSpecialist: boolean;
  emailVerifiedAt: Date | null;
  adminRole: string | null;
  legalFirstNameKa?: string | null;
  legalLastNameKa?: string | null;
  legalFirstNameEn?: string | null;
  legalLastNameEn?: string | null;
  nationalId?: string | null;
  personalNumber?: string | null;
  phone?: string | null;
  payoutIban?: string | null;
  avatarUrl?: string | null;
  cvUrl?: string | null;
  bio?: string | null;
  companyName?: string | null;
  industry?: string | null;
  websiteUrl?: string | null;
  companyDescription?: string | null;
  verificationDocUrl?: string | null;
  verificationLevel?: string | null;
  isVerified?: boolean;
  verificationStatus?: string | null;
  primaryIntent?: string | null;
  taxId?: string | null;
  termsAcceptedAt?: Date | null;
  trialStartDate?: Date | null;
  aiTrialEndsAt?: Date | null;
  aiSubscriptionActive?: boolean;
  freelancerSkills?: string[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isVerifiedGraduate: user.isVerifiedGraduate,
    isHrSpecialist: user.isHrSpecialist,
    emailVerifiedAt: user.emailVerifiedAt,
    adminRole: user.adminRole,
    legalFirstNameKa: user.legalFirstNameKa ?? null,
    legalLastNameKa: user.legalLastNameKa ?? null,
    legalFirstNameEn: user.legalFirstNameEn ?? null,
    legalLastNameEn: user.legalLastNameEn ?? null,
    nationalId: user.nationalId ?? null,
    personalNumber: user.personalNumber ?? null,
    phone: user.phone ?? null,
    payoutIban: user.payoutIban ?? null,
    avatarUrl: user.avatarUrl ?? null,
    cvUrl: user.cvUrl ?? null,
    bio: user.bio ?? null,
    companyName: user.companyName ?? null,
    industry: user.industry ?? null,
    websiteUrl: user.websiteUrl ?? null,
    companyDescription: user.companyDescription ?? null,
    taxId: user.taxId ?? null,
    verificationDocUrl: user.verificationDocUrl ?? null,
    verificationLevel: user.verificationLevel ?? 'NONE',
    isVerified: user.isVerified ?? false,
    verificationStatus: user.verificationStatus ?? 'UNVERIFIED',
    primaryIntent: user.primaryIntent ?? null,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    trialStartDate: user.trialStartDate ?? null,
    aiTrialEndsAt: user.aiTrialEndsAt ?? null,
    aiSubscriptionActive: user.aiSubscriptionActive ?? false,
    freelancerSkills: user.freelancerSkills ?? [],
  };
}

router.post('/register', authRateLimit, async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { name, email, password, role, primaryIntent, freelancerSkills } = result.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const hashed = await bcrypt.hash(password, 12);
  let user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashed,
      role,
      primaryIntent,
      freelancerSkills: freelancerSkills ?? [],
      // registerSchema only ever grants Student or Client (see its comment) —
      // both are self-serve roles with no vetting step, so manual admin
      // approval (UserStatus's PENDING_APPROVAL default, reserved for
      // roles like Mentor that DO need vetting) would just be a pointless
      // wall between a normal signup and their dashboard.
      status: 'APPROVED',
      // Email verification is not required — see requireApproved in
      // middleware/auth.ts.
      emailVerifiedAt: new Date(),
      // registerSchema.acceptedTerms is z.literal(true) — reaching this line
      // already guarantees explicit consent, so it's safe to timestamp now.
      termsAcceptedAt: new Date(),
    },
  });

  user = await maybePromoteSuperAdmin(user);

  const token = signToken(user);

  res.status(201).json({
    token,
    user: toUserResponse(user),
  });
});

// Precomputed once at startup — a bcrypt hash of a value nobody's real
// password can equal by construction, used purely to keep a nonexistent-
// email login attempt's response time indistinguishable from a wrong-
// password one. Without this, /login only calls bcrypt.compare (a
// deliberately slow, tens-of-ms operation) on the email-exists branch,
// letting an attacker enumerate registered emails from response timing
// alone even though both branches return the identical error message.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

router.post('/login', loginRateLimit, async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { email, password } = result.data;
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatch) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (user.isBanned) {
    return res.status(403).json({ message: 'This account has been banned.' });
  }
  if (user.deletionRequestedAt) {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }

  user = await maybePromoteSuperAdmin(user);
  const token = signToken(user);

  res.json({
    token,
    user: toUserResponse(user),
  });
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DELETION_GRACE_PERIOD_DAYS = 60;

// Soft-delete: deactivates the account immediately (blocked from login and
// requireApproved-gated actions — see middleware/auth.ts) and records when
// deletion was requested. There is no cron yet that hard-purges accounts
// after the 60-day window — this endpoint only marks the account, it does
// not itself schedule or perform the later permanent deletion.
router.post('/delete-account', authenticate, async (req, res) => {
  const result = deleteAccountSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(401).json({ message: 'Account no longer exists.' });
  }
  if (user.deletionRequestedAt) {
    return res.status(400).json({ message: 'Account deletion has already been requested.' });
  }

  if (result.data.password) {
    const passwordMatch = await bcrypt.compare(result.data.password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }
  }
  // else: confirmText === 'DELETE', already validated by the schema's refine().

  const deletionRequestedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { deletionRequestedAt },
  });

  res.json({
    message: 'Your account has been deactivated and scheduled for deletion.',
    deletionRequestedAt,
    permanentDeletionAt: new Date(deletionRequestedAt.getTime() + DELETION_GRACE_PERIOD_DAYS * MS_PER_DAY),
  });
});

router.post('/verify-email', authRateLimit, async (req, res) => {
  const result = verifyEmailSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const user = await prisma.user.findUnique({ where: { emailVerificationToken: result.data.token } });
  if (!user) {
    return res.status(400).json({ message: 'Invalid or already-used verification link.' });
  }
  if (!user.emailVerificationTokenExpires || user.emailVerificationTokenExpires < new Date()) {
    return res.status(400).json({ message: 'This verification link has expired. Please request a new one.' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationTokenExpires: null },
  });

  res.json({ message: 'Email verified successfully.', user: toUserResponse(updated) });
});

router.post('/resend-verification', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(401).json({ message: 'Account no longer exists.' });
  }
  if (user.emailVerifiedAt) {
    return res.status(400).json({ message: 'Your email is already verified.' });
  }

  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    },
  });
  sendVerificationEmail(user.email, emailVerificationToken);

  res.json({ message: 'Verification email sent.' });
});

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter than email verification since it grants account takeover, not just a status flag

router.post('/forgot-password', authRateLimit, async (req, res) => {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: result.data.email.toLowerCase() } });
    // Deliberately always 200, whether or not the account exists — a
    // different response here would let anyone enumerate registered emails.
    if (!user || user.isBanned || user.deletionRequestedAt) {
      return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
    }

    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashResetToken(passwordResetToken),
        passwordResetTokenExpires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });
    // The raw (unhashed) token is what goes in the email link — only its hash
    // is ever stored, see hashResetToken() above. sendPasswordResetEmail is
    // fire-and-forget: it already catches its own Resend/network failures
    // internally and falls back to a console-logged link (see emailService.ts),
    // so it deliberately isn't awaited or wrapped here.
    sendPasswordResetEmail(user.email, passwordResetToken, result.data.lang ?? 'ka');

    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    // Never let a DB-layer failure surface as a bare unstyled 500 — log for
    // diagnostics and return a clean, user-facing message instead.
    console.error('[auth] forgot-password failed:', err);
    res.status(500).json({ message: 'პაროლის აღდგენის მოთხოვნა ვერ დამუშავდა. გთხოვთ სცადოთ მოგვიანებით.' });
  }
});

router.post('/reset-password', authRateLimit, async (req, res) => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const user = await prisma.user.findUnique({ where: { passwordResetToken: hashResetToken(result.data.token) } });
  if (!user) {
    return res.status(400).json({ message: 'Invalid or already-used reset link.' });
  }
  if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
    return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' });
  }

  const hashed = await bcrypt.hash(result.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, passwordResetToken: null, passwordResetTokenExpires: null },
  });

  res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
});

// "1-Click" Google Sign-In: the frontend loads Google's GSI script, gets an
// ID token credential from the button/One Tap prompt, and POSTs it here —
// this never sees the user's Google password, only a signed token we verify
// against Google's public keys (google-auth-library handles key rotation).
router.post('/google', authRateLimit, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    // Captured (not just console.error'd) because this is the "someone
    // wiped/never set the env var" case — the kind of failure that's easy
    // to miss in raw logs but should page/alert like any other outage,
    // since it silently breaks Google Sign-In for every single visitor.
    console.error('[auth] Google Sign-In attempted but GOOGLE_CLIENT_ID is not configured.');
    Sentry.captureMessage('Google Sign-In attempted with no GOOGLE_CLIENT_ID configured', {
      level: 'error',
      tags: { route: 'auth/google', cause: 'not_configured' },
    });
    return res.status(501).json({ message: 'Google Sign-In is not configured on this server.' });
  }
  const result = googleAuthSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: result.data.idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    // Logged server-side AND to Sentry — the client-facing message stays
    // generic so it can't be used to probe why a specific token was
    // rejected, but an operator debugging a wave of failed sign-ins (e.g. a
    // misconfigured GOOGLE_CLIENT_ID — the `aud` mismatch shows up here as
    // "Wrong recipient, payload audience != requiredAudience" — vs a
    // genuinely expired/replayed token) needs the real cause, not just "it
    // failed." Tagged distinctly from the not-configured branch above so
    // Sentry can group "config problem" separately from "verification
    // problem" without reading the message text.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[auth] Google ID token verification failed:', message);
    Sentry.captureException(err, {
      tags: { route: 'auth/google', cause: 'token_verification_failed' },
      extra: { verifyIdTokenError: message },
    });
    return res.status(401).json({ message: 'Invalid or expired Google credential.' });
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ message: 'Google account has no verified email.' });
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: normalizedEmail }] },
  });

  if (user) {
    if (user.isBanned) {
      return res.status(403).json({ message: 'This account has been banned.' });
    }
    if (user.deletionRequestedAt) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }
    if (!user.googleId) {
      // Existing email/password account signing in with Google for the first
      // time — link it, rather than creating a second account for the same email.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
    }
  } else {
    const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
    try {
      user = await prisma.user.create({
        data: {
          name: payload.name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password: randomPassword, // unusable for password login — this account signs in via Google only
          role: result.data.role ?? 'Student',
          // Same reasoning as POST /register — googleAuthSchema only ever
          // grants Student or Client, both self-serve roles that don't need
          // manual admin vetting.
          status: 'APPROVED',
          googleId: payload.sub,
          emailVerifiedAt: new Date(), // Google already verified this email
        },
      });
    } catch (err: any) {
      // The One Tap prompt / button can fire twice in quick succession (e.g.
      // a re-render right as the user clicks), sending two concurrent
      // requests for the same brand-new email — the findFirst above ran
      // before either had committed, so both took this branch. Whichever
      // commits second hits the unique email/googleId constraint here
      // instead of crashing into a raw 500.
      if (err.code === 'P2002') {
        console.error('[auth] Google sign-up race on', normalizedEmail, '— retrying as existing user.');
        user = await prisma.user.findFirst({
          where: { OR: [{ googleId: payload.sub }, { email: normalizedEmail }] },
        });
        if (!user) throw err;
      } else {
        throw err;
      }
    }
  }

  user = await maybePromoteSuperAdmin(user);
  const token = signToken(user);
  res.json({ token, user: toUserResponse(user) });
});

// ============================================================
// GITHUB / FACEBOOK SIGN-IN — unlike Google above (client-side ID token,
// verified server-side with no redirect), GitHub and Facebook only support
// the traditional server-side flow: the browser is redirected to the
// provider, the provider redirects back here with a `code`, this backend
// exchanges that code for an access token and fetches the profile itself.
// The frontend buttons are therefore plain links to GET /github or
// /facebook, not a JS SDK popup — see AuthModal.tsx.
// ============================================================

router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(501).json({ message: 'GitHub Sign-In is not configured on this server.' });
  }
  const role = req.query.role === 'Client' ? 'Client' : req.query.role === 'Student' ? 'Student' : undefined;
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', GITHUB_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', signOauthState(role));
  res.redirect(authorizeUrl.toString());
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const failRedirect = `${FRONTEND_URL}/auth/login?error=github`;
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) return res.redirect(failRedirect);

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') return res.redirect(failRedirect);

  let role: 'Student' | 'Client' | undefined;
  try {
    role = verifyOauthState(state).role;
  } catch {
    return res.redirect(failRedirect);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      console.error('[auth] GitHub token exchange failed:', tokenData.error ?? tokenData);
      return res.redirect(failRedirect);
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
    });
    const profile = (await profileRes.json()) as {
      id: number; login: string; name: string | null; email: string | null; avatar_url: string | null;
    };

    // GitHub's /user endpoint omits `email` when the user has it set to
    // private (common) — the verified primary address needs a second call.
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
      });
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? null;
    }
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=github_no_email`);
    }

    const githubId = String(profile.id);
    const normalizedEmail = email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ githubId }, { email: normalizedEmail }] } });

    if (user) {
      if (user.isBanned) return res.redirect(`${FRONTEND_URL}/auth/login?error=banned`);
      if (user.deletionRequestedAt) return res.redirect(`${FRONTEND_URL}/auth/login?error=deactivated`);
      if (!user.githubId) {
        // Existing email/password (or Google) account signing in with
        // GitHub for the first time — link it rather than creating a
        // second account for the same email.
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubId, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
        });
      }
    } else {
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
      try {
        user = await prisma.user.create({
          data: {
            name: profile.name || profile.login || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password: randomPassword, // unusable — this account signs in via GitHub only
            role: role ?? 'Student',
            status: 'APPROVED',
            githubId,
            avatarUrl: profile.avatar_url || null,
            emailVerifiedAt: new Date(),
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          user = await prisma.user.findFirst({ where: { OR: [{ githubId }, { email: normalizedEmail }] } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    user = await maybePromoteSuperAdmin(user);
    const token = signToken(user);
    res.redirect(`${FRONTEND_URL}/auth/oauth-callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] GitHub OAuth callback failed:', err instanceof Error ? err.message : err);
    res.redirect(failRedirect);
  }
});

router.get('/facebook', (req: Request, res: Response) => {
  if (!FACEBOOK_CLIENT_ID) {
    return res.status(501).json({ message: 'Facebook Sign-In is not configured on this server.' });
  }
  const role = req.query.role === 'Client' ? 'Client' : req.query.role === 'Student' ? 'Student' : undefined;
  const authorizeUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authorizeUrl.searchParams.set('client_id', FACEBOOK_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', FACEBOOK_CALLBACK_URL);
  authorizeUrl.searchParams.set('scope', 'email,public_profile');
  authorizeUrl.searchParams.set('state', signOauthState(role));
  res.redirect(authorizeUrl.toString());
});

router.get('/facebook/callback', async (req: Request, res: Response) => {
  const failRedirect = `${FRONTEND_URL}/auth/login?error=facebook`;
  if (!FACEBOOK_CLIENT_ID || !FACEBOOK_CLIENT_SECRET) return res.redirect(failRedirect);

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') return res.redirect(failRedirect);

  let role: 'Student' | 'Client' | undefined;
  try {
    role = verifyOauthState(state).role;
  } catch {
    return res.redirect(failRedirect);
  }

  try {
    const redirectUri = FACEBOOK_CALLBACK_URL;
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_CLIENT_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_CLIENT_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: unknown };
    if (!tokenData.access_token) {
      console.error('[auth] Facebook token exchange failed:', tokenData.error ?? tokenData);
      return res.redirect(failRedirect);
    }

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email,picture');
    profileUrl.searchParams.set('access_token', tokenData.access_token);
    const profileRes = await fetch(profileUrl.toString());
    const profile = (await profileRes.json()) as {
      id: string; name?: string; email?: string; picture?: { data?: { url?: string } };
    };

    if (!profile.email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=facebook_no_email`);
    }

    const facebookId = String(profile.id);
    const normalizedEmail = profile.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ facebookId }, { email: normalizedEmail }] } });

    if (user) {
      if (user.isBanned) return res.redirect(`${FRONTEND_URL}/auth/login?error=banned`);
      if (user.deletionRequestedAt) return res.redirect(`${FRONTEND_URL}/auth/login?error=deactivated`);
      if (!user.facebookId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { facebookId, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
        });
      }
    } else {
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 12);
      try {
        user = await prisma.user.create({
          data: {
            name: profile.name || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            password: randomPassword, // unusable — this account signs in via Facebook only
            role: role ?? 'Student',
            status: 'APPROVED',
            facebookId,
            avatarUrl: profile.picture?.data?.url || null,
            emailVerifiedAt: new Date(),
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          user = await prisma.user.findFirst({ where: { OR: [{ facebookId }, { email: normalizedEmail }] } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    user = await maybePromoteSuperAdmin(user);
    const token = signToken(user);
    res.redirect(`${FRONTEND_URL}/auth/oauth-callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[auth] Facebook OAuth callback failed:', err instanceof Error ? err.message : err);
    res.redirect(failRedirect);
  }
});

// ============================================================
// PROFILE — legal identity fields (dashboard/settings), separate from the
// admin-facing user management in routes/admin.ts.
// ============================================================

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'Account no longer exists.' });
  res.json({ user: toUserResponse(user) });
});

// Explicit consent action — the frontend's blocking first-login modal (shown
// to any authenticated user with termsAcceptedAt still null: pre-existing
// accounts and every Google sign-up, which has no separate consent step
// before account creation) calls this once the user clicks "I agree".
// Idempotent: a second call just re-confirms rather than erroring.
router.post('/accept-terms', authenticate, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { termsAcceptedAt: new Date() },
  });
  res.json({ user: toUserResponse(user) });
});

// Self-serve avatar upload — any authenticated user, buffered in memory then
// pushed straight to Bunny Storage (no local disk write). Deliberately its
// own endpoint rather than a freely-settable field on PUT /me: this way the
// server always computes the URL from an actual uploaded file, so a user's
// public-facing avatar can never be pointed at an arbitrary external URL.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image uploads are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/me/avatar',
  authenticate,
  (req: Request, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } });

    const filename = `avatar-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'avatars',
        filename,
      });
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: url } });

      if (previous?.avatarUrl && previous.avatarUrl !== url) {
        deleteManagedImage(previous.avatarUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Avatar upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Self-serve CV/résumé upload — any authenticated user (freelancers
// attaching one to a gig/vacancy application, mentors, anyone). Same
// buffered-then-Bunny-Storage flow as the avatar upload above, and same
// "own endpoint rather than a freely-settable field" reasoning: the URL is
// only ever the server's own upload, never an arbitrary pasted link. This
// is the same User.cvUrl field the admin-only mentor CV upload
// (routes/adminMentorship.ts) writes to — one field, two upload paths.
const CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const cvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (CV_MIME_TYPES.includes(file.mimetype) || /\.(pdf|docx?)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF or DOCX files are allowed.'));
  },
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — plenty for a CV
});

router.post(
  '/me/cv',
  authenticate,
  (req: Request, res: Response, next) => {
    cvUpload.single('cv')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The file exceeds 15MB.' });
      }
      return res.status(400).json({ message: err.message || 'Only PDF or DOCX files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { cvUrl: true } });

    const filename = `cv-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname) || '.pdf'}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'user-cvs',
        filename,
      });
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { cvUrl: url } });

      if (previous?.cvUrl && previous.cvUrl !== url) {
        deleteManagedImage(previous.cvUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'CV upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Business KYC — self-serve upload of a Public Registry Extract / company
// registration document. Never sets isVerified (only an admin can, via
// routes/adminCompanies.ts) — uploading just moves the account into the
// "Under Review" state, derived on the frontend from doc-present + not-yet-verified.
const verificationDocUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, or WEBP files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Platform default when a taxId has no BusinessAccountLimit override row —
// see the model's own schema comment for the override mechanism.
const BUSINESS_TAX_ID_DEFAULT_LIMIT = 3;

router.post(
  '/me/verification-doc',
  authenticate,
  (req: Request, res: Response, next) => {
    if (!isBunnyStorageConfigured()) {
      return res.status(501).json({ message: 'Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL).' });
    }
    next();
  },
  verificationDocUpload.single('document'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { verificationDocUrl: true, taxId: true, aiTrialEndsAt: true, companyName: true },
    });

    // Anti-fraud cap: at most N distinct accounts may verify against the
    // same Company ID (ს/კ) — counts every OTHER account already on this
    // taxId regardless of their own approval status, since the fraud risk
    // is "how many accounts registered under this code," not just how many
    // were approved. A taxId with no submitted business documents yet has
    // nothing to count against, so this only fires once the user has
    // actually set a taxId on their profile (see VerificationDrawer.tsx).
    if (previous?.taxId) {
      const [override, accountsOnThisTaxId] = await Promise.all([
        prisma.businessAccountLimit.findUnique({ where: { taxId: previous.taxId } }),
        prisma.user.count({ where: { taxId: previous.taxId, id: { not: req.user!.id } } }),
      ]);
      // maxAccounts === null on an override row means "unlimited" (an
      // explicit admin removal of the cap) — Infinity makes that branch of
      // the comparison below a no-op without a separate special case.
      const effectiveLimit = override ? override.maxAccounts ?? Infinity : BUSINESS_TAX_ID_DEFAULT_LIMIT;
      if (accountsOnThisTaxId >= effectiveLimit) {
        return res.status(409).json({ message: 'ეს ს/კ უკვე გამოყენებულია დაშვებული ექაუნთების მაქსიმალურ რაოდენობაზე.' });
      }
    }

    const filename = `kyc-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadToBunnyStorage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'kyc',
        filename,
      });

      // Best-effort instant auto-verification: only fires on a clean,
      // high-confidence match against the business's own self-reported
      // taxId (see businessKycService.ts's shouldAutoApprove) — anything
      // else (not configured, low score, non-ACTIVE status, no taxId on
      // file, a parse error) just leaves isVerified false, which is already
      // the fallback "needs manual admin review" state, so a failure here
      // never blocks the upload itself. The extracted fields are persisted
      // either way so the admin inspection drawer has something to show
      // even when auto-approval didn't fire.
      let autoVerified = false;
      let extractedData: Awaited<ReturnType<typeof parseBusinessDocument>> | null = null;
      if (isBusinessKycParsingConfigured()) {
        try {
          extractedData = await parseBusinessDocument(req.file.buffer, req.file.mimetype);
          if (previous?.taxId && shouldAutoApprove(extractedData, previous.taxId)) {
            autoVerified = true;
          }
        } catch (err) {
          console.error('[auth] Business KYC document parsing failed (falling back to manual review):', err);
        }
      }

      // A resubmission always resets isVerified unless it just auto-passed
      // — a previously-verified business swapping in a new document needs
      // a fresh look (automated or manual), not to keep riding on the old
      // document's approval.
      // Same first-time-only trial grant as routes/adminCompanies.ts's
      // setVerified() — this auto-verify path used to bypass it entirely,
      // meaning a business whose document auto-matched never got the AI
      // Agents Suite trial an admin-approved business gets.
      const isFirstTrialGrant = autoVerified && !previous?.aiTrialEndsAt;
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          verificationDocUrl: url,
          verificationLevel: 'BUSINESS',
          isVerified: autoVerified,
          verificationStatus: autoVerified ? 'APPROVED' : 'PENDING',
          businessKycRejectionReason: null,
          ...(extractedData
            ? {
                businessKycExtractedData: extractedData as unknown as Prisma.InputJsonValue,
                businessKycScore: extractedData.confidenceScore,
                businessKycReasoning: extractedData.reasoning,
                businessKycCheckedAt: new Date(),
              }
            : {}),
          ...(isFirstTrialGrant
            ? { trialStartDate: new Date(), aiTrialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            : {}),
        },
      });

      if (previous?.verificationDocUrl && previous.verificationDocUrl !== url) {
        deleteBunnyStorageUrlIfManaged(previous.verificationDocUrl).catch(() => {});
      }

      if (autoVerified) {
        sendBusinessVerifiedEmail(user.email, previous?.companyName ?? '').catch((err) =>
          console.error('[auth] sendBusinessVerifiedEmail failed:', err instanceof Error ? err.message : err)
        );
        prisma.notification
          .create({
            data: {
              userId: user.id,
              title: 'თქვენი ბიზნეს ანგარიში დადასტურდა',
              message: 'AI-მ ავტომატურად დაადასტურა თქვენი დოკუმენტი — Buy/Sell წვდომა უკვე ხელმისაწვდომია.',
              type: 'BUSINESS_KYC',
            },
          })
          .catch((err) => console.error('[auth] business-kyc notification failed:', err));
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Document upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Individual identity verification — self-serve upload of an ID card/
// passport scan, the INDIVIDUAL counterpart to the BUSINESS KYC upload
// above. Unlike the business path, there's no automated-parsing/auto-
// approve heuristic for a personal ID (no equivalent of
// businessKycService.ts's taxId cross-check exists), so this always lands
// PENDING for manual admin review — see routes/adminVerifications.ts's
// verify-individual/reject-individual. Never touches isVerified/
// isVerifiedGraduate (those stay BUSINESS-only / skill-earned-only
// respectively) — an approved individual verification is read as an
// additional OR-condition alongside isVerifiedGraduate wherever freelancer
// marketplace rights are gated (gigs.ts, vacancies.ts, products.ts,
// forum.ts), not folded into either existing flag.
// 11-digit Georgian personal ID number — see the personalNumber comment on
// the User model for why this is a separate field/constraint from the
// pre-existing free-form nationalId.
const PERSONAL_NUMBER_PATTERN = /^\d{11}$/;

router.post(
  '/me/individual-verification-doc',
  authenticate,
  (req: Request, res: Response, next) => {
    if (!isBunnyStorageConfigured()) {
      return res.status(501).json({ message: 'Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL).' });
    }
    next();
  },
  verificationDocUpload.single('document'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    // multer parses multipart text fields into req.body alongside req.file
    // — the frontend sends this in the same request as the document itself,
    // so the anti-fraud KYC number and the ID scan it belongs to are always
    // submitted as one atomic verification act, never out of sync.
    const personalNumber = typeof req.body.personalNumber === 'string' ? req.body.personalNumber.trim() : '';
    if (!PERSONAL_NUMBER_PATTERN.test(personalNumber)) {
      return res.status(400).json({ message: 'პირადი ნომერი უნდა შედგებოდეს ზუსტად 11 ციფრისგან.' });
    }
    const existingOwner = await prisma.user.findUnique({ where: { personalNumber }, select: { id: true } });
    if (existingOwner && existingOwner.id !== req.user!.id) {
      return res.status(409).json({ message: 'ეს პირადი ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.' });
    }

    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { verificationDocUrl: true, verificationLevel: true } });

    const filename = `id-verification-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadToBunnyStorage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'individual-verification', filename });

      let user;
      try {
        user = await prisma.user.update({
          where: { id: req.user!.id },
          data: {
            verificationDocUrl: url,
            verificationLevel: 'INDIVIDUAL',
            verificationStatus: 'PENDING',
            businessKycRejectionReason: null,
            personalNumber,
          },
        });
      } catch (err: any) {
        // Defense-in-depth against a race (two requests both passing the
        // findUnique check above before either commits) — the @unique
        // constraint is the real guarantee, this just turns its violation
        // into the same clean, localized message instead of a raw 500.
        if (err.code === 'P2002') {
          deleteBunnyStorageUrlIfManaged(url).catch(() => {});
          return res.status(409).json({ message: 'ეს პირადი ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.' });
        }
        throw err;
      }

      // Only delete the old file if it was itself an INDIVIDUAL-level
      // upload — never delete out from under a BUSINESS submission the
      // user might switch back to reviewing (each level keeps its own doc
      // conceptually; this reuses the single verificationDocUrl column, so
      // switching levels does mean only the most recent submission's file
      // survives, which matches "one active submission at a time" above).
      if (previous?.verificationDocUrl && previous.verificationDocUrl !== url) {
        deleteBunnyStorageUrlIfManaged(previous.verificationDocUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Document upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.put('/me', authenticate, async (req, res) => {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { payoutIban, websiteUrl, ...rest } = result.data;
  const normalizedIban = payoutIban || null;

  // Read the current value first so we can tell whether this request is
  // actually changing it — payoutIban is the one field on this route real
  // money follows, and bogPayoutService's risk engine treats a recent
  // change to it as a mandatory manual-review trigger regardless of
  // amount (see User.payoutIbanUpdatedAt's own schema comment). Only
  // stamped — and only emailed — on a genuine change, not every PUT that
  // happens to re-submit the same value.
  const before = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { payoutIban: true, email: true } });
  const ibanChanged = payoutIban !== undefined && normalizedIban !== (before?.payoutIban ?? null);

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...rest,
      payoutIban: normalizedIban,
      websiteUrl: websiteUrl || null,
      ...(ibanChanged ? { payoutIbanUpdatedAt: new Date() } : {}),
    },
  });
  if (ibanChanged && before?.email) {
    sendPayoutIbanChangedEmail(before.email).catch((err) => console.error(`[auth] sendPayoutIbanChangedEmail failed for ${before.email}:`, err));
  }
  res.json({ user: toUserResponse(user) });
});

router.put('/me/password', authenticate, async (req, res) => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'Account no longer exists.' });
  if (user.googleId) {
    return res.status(400).json({ message: 'This account signs in via Google and has no password to change.' });
  }
  const currentMatches = await bcrypt.compare(result.data.currentPassword, user.password);
  if (!currentMatches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  const hashed = await bcrypt.hash(result.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  res.json({ message: 'Password updated successfully.' });
});

export default router;