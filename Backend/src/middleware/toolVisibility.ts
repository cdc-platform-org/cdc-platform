/**
 * Middleware: enforces the "Admin only" visibility an admin can set on an AI
 * tool in the Tool Catalog CMS (Frontend pages/admin/tools.tsx, stored as
 * SiteContent page "tool-catalog"). The public pages hide such a tool's card,
 * and this makes the tool's own API refuse non-admins too, so hiding it is
 * not just cosmetic. Only write requests (POST/PUT/PATCH/DELETE: starting,
 * generating, paying) are blocked; reads stay open so people who already
 * used the tool keep their books/lessons, shared links keep working, and
 * media loaded by plain <img>/<audio> URLs (no auth header) never breaks
 * for the admin either. Other statuses (ACTIVE / COMING_SOON / DISABLED) keep
 * their existing frontend-only behaviour and are not enforced here.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../utils/env';

const TOOL_CATALOG_PAGE = 'tool-catalog';
const CACHE_TTL_MS = 30_000;

let cache: { at: number; adminOnly: Set<string> } | null = null;

// Called by adminCms.ts after a save so a status change applies immediately
// on this instance (other instances pick it up within CACHE_TTL_MS).
export function invalidateToolVisibilityCache(): void {
  cache = null;
}

async function adminOnlySlugs(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.adminOnly;
  const row = await prisma.siteContent.findUnique({ where: { page: TOOL_CATALOG_PAGE }, select: { content: true } });
  const tools = (row?.content as { tools?: { slug?: string; status?: string }[] } | null)?.tools ?? [];
  const adminOnly = new Set(tools.filter((t) => t.status === 'ADMIN_ONLY' && t.slug).map((t) => t.slug!.trim()));
  cache = { at: Date.now(), adminOnly };
  return adminOnly;
}

async function isAdminCaller(req: Request): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), JWT_SECRET, { algorithms: ['HS256'] }) as { userId: string };
    // adminRole is not in the JWT — same DB lookup requireAdminRole() does.
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { adminRole: true, isBanned: true } });
    return !!user?.adminRole && !user.isBanned;
  } catch {
    return false;
  }
}

export function requireToolVisible(slug: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    try {
      const adminOnly = await adminOnlySlugs();
      if (!adminOnly.has(slug)) return next();
      if (await isAdminCaller(req)) return next();
      return res.status(403).json({ code: 'TOOL_ADMIN_ONLY', message: 'This tool is currently not available.' });
    } catch (err) {
      // Fail open: a CMS read hiccup must not take every tool offline.
      console.error('[toolVisibility] check failed, allowing request:', err);
      return next();
    }
  };
}
