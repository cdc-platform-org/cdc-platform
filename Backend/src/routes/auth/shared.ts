/**
 * Helpers shared by the auth routers: rate limits, OAuth state signing,
 * JWT issuing, login tracking, super-admin promotion and toUserResponse()
 * (the single shape every endpoint returns a user in).
 */
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { rateLimit } from '../../middleware/rateLimit';
import { issueSessionId } from '../../services/educator/educatorVipService';
import {
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
  SUPER_ADMIN_EMAILS,
} from '../../utils/env';
import { recordLoginEvent } from '../../services/account/sessionAnomalyService';

export const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Same fallback pattern as payments.ts/emailService.ts/certificateService.ts.
export const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// Tighter, dedicated budget for /login specifically — the one endpoint an
// actual credential-stuffing/brute-force script would hit directly, as
// opposed to authRateLimit below which just needs to stop casual abuse of
// the other unauthenticated endpoints.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please wait before trying again.',
});

// Shared budget for the other unauthenticated, credential-adjacent
// endpoints (registration, password reset, email verification, OAuth token
// exchange) — same in-memory/IP-keyed limiter as everywhere else in this
// app (see middleware/rateLimit.ts), just a looser cap than loginRateLimit
// since none of these is a single guessable secret to brute-force.
export const authRateLimit = rateLimit({
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
export function signOauthState(role?: 'Student' | 'Client'): string {
  return jwt.sign({ role, purpose: 'oauth-state' }, JWT_SECRET, { expiresIn: '10m' });
}
export function verifyOauthState(state: string): { role?: 'Student' | 'Client' } {
  const payload = jwt.verify(state, JWT_SECRET) as { role?: 'Student' | 'Client'; purpose?: string };
  if (payload.purpose !== 'oauth-state') throw new Error('Invalid state token.');
  return { role: payload.role };
}

// Only the SHA-256 hash of a password-reset token is ever persisted — the
// raw token exists only in the emailed link and the requester's browser.
// A DB read (backup leak, injection, etc.) on its own can't be turned into
// a working reset link this way, the same defense-in-depth pattern as
// storing bcrypt hashes of passwords rather than the passwords themselves.
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
export async function maybePromoteSuperAdmin(user: User): Promise<User> {
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

// Rotates the caller's currentSessionId (services/educatorVipService.ts's
// issueSessionId) and embeds it as the `sid` claim — see
// middleware/auth.ts's requireCurrentEducatorSession for what this
// actually enforces (Educator VIP Hub routes only, not sitewide).
export async function signToken(user: { id: string; role: string; email: string }) {
  const sid = await issueSessionId(user.id);
  return jwt.sign({ userId: user.id, role: user.role, email: user.email, sid }, JWT_SECRET, { expiresIn: '7d' });
}

// Called at every one of this file's five successful-authentication points
// (register, login, google, github/callback, facebook/callback) — builds
// the history sessionAnomalyService.detectSessionAnomaly later compares a
// financial action's IP/device against. Fire-and-forget: a login must
// never fail (or even slow down) because this insert is momentarily slow,
// same posture as every notification email send elsewhere in this file —
// worst case, one login's history entry is missing, which only ever makes
// a later risk check MORE cautious (see detectSessionAnomaly's fail-safe
// default), never less.
export function trackLoginEvent(userId: string, req: Request): void {
  recordLoginEvent(userId, req.ip ?? 'unknown', req.headers['user-agent']).catch((err) =>
    console.error(`[auth] recordLoginEvent failed for user ${userId}:`, err)
  );
}

export function toUserResponse(user: {
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
