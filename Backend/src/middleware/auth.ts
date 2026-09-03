import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../utils/env';

export interface AuthenticatedUser {
  id: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  email: string;
  // The session id this JWT was issued with (routes/auth.ts's signToken) —
  // undefined for any token signed before this field existed, which
  // requireCurrentEducatorSession below treats as "stale, reject" rather
  // than crashing on a missing claim.
  sid?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      // Set by requireAdminRole() once it's confirmed the caller's tier —
      // handlers that need to know WHICH tier (e.g. "only SUPER_ADMIN may
      // act on a fellow admin-team member") read this instead of re-querying.
      adminRole?: AdminRoleTier;
    }
  }
}

interface JwtPayload {
  userId: string;
  role: AuthenticatedUser['role'];
  email: string;
  sid?: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role, email: payload.email, sid: payload.sid };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Like authenticate(), but never rejects — a missing/invalid/expired token
// just proceeds as anonymous (req.user stays undefined). For routes that are
// public by default but behave differently for a logged-in caller (e.g. the
// blog list/detail routes showing drafts to admins only).
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role, email: payload.email };
  } catch {
    // Invalid/expired token on an optional-auth route — proceed as anonymous
    // rather than 401ing a visitor who just has a stale token in storage.
  }
  next();
}

export function requireRole(...allowedRoles: AuthenticatedUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    // Grant unlimited free access to SuperAdmin
    if (req.user.role === 'SuperAdmin') {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

export async function requireApproved(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { status: true, deletionRequestedAt: true, isBanned: true },
  });
  if (!user) {
    return res.status(401).json({ message: 'Account no longer exists.' });
  }
  if (user.isBanned) {
    return res.status(403).json({ message: 'This account has been banned.' });
  }
  if (user.deletionRequestedAt) {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }
  if (user.status !== 'APPROVED') {
    return res.status(403).json({ message: 'Your account is pending administrator approval.' });
  }
  next();
}

// Closes a real gap: authenticate() only verifies the JWT itself (up to 7
// days old, see auth.ts's signToken) — it never re-checks the account's
// current standing, so a user banned or who self-requested deletion AFTER
// their token was issued stays fully authenticated on any route guarded by
// authenticate alone until that token naturally expires. requireApproved
// already closes this for routes that also gate on approval status; this
// is the lighter version for routes (billing, wallet payouts) that
// shouldn't require a PENDING account to be blocked, but must never allow
// a banned/deleted one through. Same DB-lookup-per-request cost as
// requireApproved/requireAdminRole — an accepted tradeoff already made
// throughout this file for anything security-sensitive.
export async function requireNotBannedOrDeleted(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isBanned: true, deletionRequestedAt: true },
  });
  if (!user) {
    return res.status(401).json({ message: 'Account no longer exists.' });
  }
  if (user.isBanned) {
    return res.status(403).json({ message: 'This account has been banned.' });
  }
  if (user.deletionRequestedAt) {
    return res.status(403).json({ message: 'This account has been deactivated.' });
  }
  next();
}

// Single-active-session lock for the AI Educator VIP Hub — anti
// account-sharing measure (see User.currentSessionId's own schema comment
// for why this is scoped to just these routes rather than wired into
// authenticate() itself). currentSessionId is rotated on every login
// (routes/auth.ts's signToken → services/educatorVipService.ts's
// issueSessionId), so a token whose `sid` claim no longer matches the DB
// value was issued to a session a LATER login has since superseded —
// reject it distinctly (409, not 401) so the frontend can show "signed in
// elsewhere" rather than a generic "please log in again".
export async function requireCurrentEducatorSession(req: Request, res: Response, next: NextFunction) {
  // Concurrent login restriction disabled. Allow multiple sessions.
  next();
}

export type AdminRoleTier = 'SUPER_ADMIN' | 'MANAGER' | 'MODERATOR';

// Internal admin-team permission tier — deliberately separate from
// requireRole('SuperAdmin') (the marketplace role). The JWT doesn't carry
// adminRole, so this always does a DB lookup, same as requireApproved.
export function requireAdminRole(...allowedTiers: AdminRoleTier[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { adminRole: true, isBanned: true, deletionRequestedAt: true },
    });
    if (!user || user.isBanned || user.deletionRequestedAt) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    if (!user.adminRole || !allowedTiers.includes(user.adminRole)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    req.adminRole = user.adminRole;
    next();
  };
}
