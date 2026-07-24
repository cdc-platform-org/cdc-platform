import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../utils/env';

export interface AuthenticatedUser {
  id: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  email: string;
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
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(...allowedRoles: AuthenticatedUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
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
    select: { status: true, deletionRequestedAt: true, emailVerifiedAt: true, isBanned: true },
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
  if (!user.emailVerifiedAt) {
    return res.status(403).json({ message: 'Please verify your email before continuing.' });
  }
  if (user.status !== 'APPROVED') {
    return res.status(403).json({ message: 'Your account is pending administrator approval.' });
  }
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
