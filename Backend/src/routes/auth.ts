import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import { User } from '@prisma/client';
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
import { JWT_SECRET, GOOGLE_CLIENT_ID, SUPER_ADMIN_EMAILS } from '../utils/env';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { uploadToBunnyStorage, isBunnyStorageConfigured, BunnyStorageUploadError, deleteBunnyStorageUrlIfManaged } from '../services/bunnyStorage';
import { parseBusinessDocument, isBusinessKycParsingConfigured, taxIdsMatch } from '../services/businessKycService';

const router = Router();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
  emailVerifiedAt: Date | null;
  adminRole: string | null;
  legalFirstNameKa?: string | null;
  legalLastNameKa?: string | null;
  legalFirstNameEn?: string | null;
  legalLastNameEn?: string | null;
  nationalId?: string | null;
  phone?: string | null;
  payoutIban?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  companyName?: string | null;
  industry?: string | null;
  websiteUrl?: string | null;
  companyDescription?: string | null;
  verificationDocUrl?: string | null;
  isVerified?: boolean;
  taxId?: string | null;
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
    legalFirstNameKa: user.legalFirstNameKa ?? null,
    legalLastNameKa: user.legalLastNameKa ?? null,
    legalFirstNameEn: user.legalFirstNameEn ?? null,
    legalLastNameEn: user.legalLastNameEn ?? null,
    nationalId: user.nationalId ?? null,
    phone: user.phone ?? null,
    payoutIban: user.payoutIban ?? null,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    companyName: user.companyName ?? null,
    industry: user.industry ?? null,
    websiteUrl: user.websiteUrl ?? null,
    companyDescription: user.companyDescription ?? null,
    taxId: user.taxId ?? null,
    verificationDocUrl: user.verificationDocUrl ?? null,
    isVerified: user.isVerified ?? false,
  };
}

router.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { name, email, password, role } = result.data;
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
      role,
      // registerSchema only ever grants Student or Client (see its comment) —
      // both are self-serve roles with no vetting step, so manual admin
      // approval (UserStatus's PENDING_APPROVAL default, reserved for
      // roles like Mentor that DO need vetting) would just be a pointless
      // wall between a normal signup and their dashboard.
      status: 'APPROVED',
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

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter than email verification since it grants account takeover, not just a status flag

router.post('/forgot-password', async (req, res) => {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

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
  // is ever stored, see hashResetToken() above.
  sendPasswordResetEmail(user.email, passwordResetToken, result.data.lang ?? 'ka');

  res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
});

router.post('/reset-password', async (req, res) => {
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
  } catch (err) {
    // Logged server-side only — the client-facing message stays generic so
    // it can't be used to probe why a specific token was rejected, but an
    // operator debugging a wave of failed sign-ins (e.g. a misconfigured
    // GOOGLE_CLIENT_ID) needs the real cause, not just "it failed."
    console.error('[auth] Google ID token verification failed:', err instanceof Error ? err.message : err);
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
// PROFILE — legal identity fields (dashboard/settings), separate from the
// admin-facing user management in routes/admin.ts.
// ============================================================

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'Account no longer exists.' });
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
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB — plenty for an avatar
});

router.post(
  '/me/avatar',
  authenticate,
  (req: Request, res: Response, next) => {
    if (!isBunnyStorageConfigured()) {
      return res.status(501).json({ message: 'Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL).' });
    }
    next();
  },
  avatarUpload.single('avatar'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } });

    const filename = `avatar-${req.user!.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadToBunnyStorage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'avatars',
        filename,
      });
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: url } });

      if (previous?.avatarUrl && previous.avatarUrl !== url) {
        deleteBunnyStorageUrlIfManaged(previous.avatarUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Avatar upload failed. Please try again.';
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
    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { verificationDocUrl: true, taxId: true } });

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
      // taxId — anything else (not configured, low confidence, no taxId
      // on file, a parse error) just leaves isVerified false, which is
      // already the fallback "needs manual admin review" state, so a
      // failure here never blocks the upload itself.
      let autoVerified = false;
      if (isBusinessKycParsingConfigured() && previous?.taxId) {
        try {
          const parsed = await parseBusinessDocument(req.file.buffer, req.file.mimetype);
          if (
            parsed.hasOfficialHeaders &&
            parsed.confidence === 'high' &&
            parsed.identificationCode &&
            taxIdsMatch(parsed.identificationCode, previous.taxId)
          ) {
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
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { verificationDocUrl: url, isVerified: autoVerified },
      });

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
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { ...rest, payoutIban: payoutIban || null, websiteUrl: websiteUrl || null },
  });
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