import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  registerSchema,
  loginSchema,
  deleteAccountSchema,
  verifyEmailSchema,
  googleAuthSchema,
} from '../schemas/authSchemas';
import { authenticate } from '../middleware/auth';
import { JWT_SECRET, GOOGLE_CLIENT_ID, SUPER_ADMIN_EMAILS } from '../utils/env';

const router = Router();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Auto-promotes accounts on the SUPER_ADMIN_EMAILS allow-list (see
// utils/env.ts) — checked on every register/login/Google sign-in so it takes
// effect immediately whichever path the account first appears through, and
// keeps re-asserting it (idempotent) in case admin rights were ever revoked
// by mistake. No-op (returns the user unchanged) if the email isn't listed
// or the account is already SUPER_ADMIN.
async function maybePromoteSuperAdmin(user: User): Promise<User> {
  if (!SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) return user;
  if (user.adminRole === 'SUPER_ADMIN' && user.role === 'SuperAdmin' && user.status === 'APPROVED') return user;
  return prisma.user.update({
    where: { id: user.id },
    data: { adminRole: 'SUPER_ADMIN', role: 'SuperAdmin', status: 'APPROVED' },
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
  emailVerifiedAt: Date | null;
  adminRole: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isVerifiedGraduate: user.isVerifiedGraduate,
    emailVerifiedAt: user.emailVerifiedAt,
    adminRole: user.adminRole,
  };
}

// No email provider is configured in this project — this stands in for
// actually sending mail. In production this would be replaced by a real
// provider call (SendGrid/SES/etc); for now the link just goes to the logs
// so the flow is fully testable end-to-end without one.
function sendVerificationEmail(email: string, token: string) {
  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
  console.log(`[DEV EMAIL] Verification link for ${email}: ${link}`);
}

router.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { name, email, password } = result.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const hashed = await bcrypt.hash(password, 12);
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  let user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashed,
      role: 'Student',
      emailVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    },
  });

  sendVerificationEmail(user.email, emailVerificationToken);
  user = await maybePromoteSuperAdmin(user);

  const token = signToken(user);

  res.status(201).json({
    token,
    user: toUserResponse(user),
  });
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { email, password } = result.data;
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
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

router.post('/verify-email', async (req, res) => {
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

// "1-Click" Google Sign-In: the frontend loads Google's GSI script, gets an
// ID token credential from the button/One Tap prompt, and POSTs it here —
// this never sees the user's Google password, only a signed token we verify
// against Google's public keys (google-auth-library handles key rotation).
router.post('/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
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
  } catch {
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
    user = await prisma.user.create({
      data: {
        name: payload.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: randomPassword, // unusable for password login — this account signs in via Google only
        role: 'Student',
        googleId: payload.sub,
        emailVerifiedAt: new Date(), // Google already verified this email
      },
    });
  }

  user = await maybePromoteSuperAdmin(user);
  const token = signToken(user);
  res.json({ token, user: toUserResponse(user) });
});

export default router;