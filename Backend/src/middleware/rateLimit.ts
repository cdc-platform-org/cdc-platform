import { Request, Response, NextFunction } from 'express';

// Dependency-free in-memory rate limiter (no express-rate-limit install) —
// fine for this single-instance deployment; would need a shared store
// (Redis) behind a load balancer. Keyed by IP, one Map per middleware
// instance so separate routes (e.g. studio inquiries vs. auth) don't share
// a budget.
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Without this, `hits` grows unbounded for a public endpoint hit by many
  // distinct IPs (bots, scanners) — sweep expired entries periodically
  // instead of on every request.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: options.message ?? 'Too many requests. Please try again later.' });
    }

    entry.count += 1;
    next();
  };
}
