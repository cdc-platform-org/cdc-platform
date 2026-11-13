/**
 * E-mail + password accounts: register, login, delete account (60-day
 * grace period), e-mail verification and password reset.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  registerSchema,
  loginSchema,
  deleteAccountSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../schemas/authSchemas';
import { authenticate } from '../../middleware/auth';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../services/integrations/emailService';
import {
  loginRateLimit,
  authRateLimit,
  hashResetToken,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  maybePromoteSuperAdmin,
  signToken,
  trackLoginEvent,
  toUserResponse,
} from './shared';

const router = Router();

router.post('/register', authRateLimit, async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { name, email, password, phone, role, primaryIntent } = result.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const hashed = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        phone,
        role,
        primaryIntent,
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
  } catch (err: any) {
    // The findUnique check above is not atomic with this create — two
    // concurrent registrations for the same email (double-submit, or a
    // scripted duplicate) can both pass it before either writes. Without
    // this catch, the loser's P2002 reached the generic error handler and
    // returned an opaque 500 instead of the same clean 409 the check above
    // was meant to guarantee on this, the highest-traffic unauthenticated
    // write route in the app.
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    throw err;
  }

  user = await maybePromoteSuperAdmin(user);

  const token = await signToken(user);
  trackLoginEvent(user.id, req);

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
  const token = await signToken(user);
  trackLoginEvent(user.id, req);

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

// Was previously unrated-limited despite every other credential-adjacent
// route in this file (register/forgot-password/reset-password/verify-email)
// using authRateLimit — an authenticated-but-unverified user could otherwise
// trigger unlimited verification emails to themselves.
router.post('/resend-verification', authenticate, authRateLimit, async (req, res) => {
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

export default router;
