import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// ============================================================
// Phase 19 — production deployment safety. Three public, unauthenticated,
// zero-cost endpoints the deploy workflow (.github/workflows/main_cdc-api-prod.yml)
// polls after a restart to prove the NEW code is actually serving traffic
// and able to reach its database — "Azure accepted the image" has never by
// itself meant "the release is healthy" (see that workflow's own header
// comment on the 13-day-stale-backend incident this phase exists to close).
//
// All three are deliberately cheap and side-effect-free: no auth, no
// writes, no calls to Azure OpenAI/Blob Storage/BOG/email/any paid or
// external provider. /api/ready is the only one that touches the database,
// and only with a trivial read.
// ============================================================

const router = Router();

// GET /api/version — build/deployment identity only. Never requires DB or
// any external dependency, so it stays answerable even if everything else
// is down (useful for telling "the process isn't running at all" apart
// from "the process is up but unhealthy").
router.get('/version', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'cdc-api',
    // package.json's own version field — a human-readable release label,
    // never the thing identity checks rely on (that's commitSha below).
    version: process.env.npm_package_version || require('../../package.json').version,
    // Baked into the image at build time (see Dockerfile's GIT_COMMIT_SHA
    // build arg, set from the workflow's already-validated deploy_sha —
    // never read from a request, header, or query string). Falls back to
    // 'unknown' for a local/dev process that wasn't built through the
    // production image pipeline, rather than lying with a fabricated value.
    commitSha: process.env.GIT_COMMIT_SHA || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  });
});

// GET /api/health — liveness only: "is the Node process up and able to
// return an HTTP response at all." Deliberately asks nothing else — a
// liveness probe that can fail because Postgres (or Azure OpenAI, or BOG)
// is briefly unavailable causes exactly the wrong reaction from whatever
// reads it (killing/restarting a process that was never the problem).
// That distinction is what /api/ready is for.
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'cdc-api' });
});

// GET /api/ready — readiness: "is this instance ready for production
// traffic." At minimum, database reachability — the one dependency every
// single route in this app needs. A query against the same table Prisma
// itself owns (_prisma_migrations) doubles as the migration-health signal
// Phase 19 also asks for: any row with finished_at still null is a
// migration that started but never completed (crashed mid-apply, or is
// stuck) — exactly the state docker-entrypoint.sh's `prisma migrate
// deploy` is supposed to prevent the container from ever serving traffic
// in, so this is a second, independent witness of that same guarantee.
// Reports only a safe category, never table/column names, counts, or any
// query detail — and never DATABASE_URL, credentials, or a raw stack trace.
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: { database: 'ok' | 'unavailable'; migrations: 'ok' | 'unhealthy' | 'unknown' } = {
    database: 'unavailable',
    migrations: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    return res.status(503).json({ status: 'not_ready', service: 'cdc-api', checks });
  }

  try {
    const stuck = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NULL
    `;
    checks.migrations = Number(stuck[0]?.count ?? 0) === 0 ? 'ok' : 'unhealthy';
  } catch {
    // The migrations table itself is unreadable for some other reason —
    // report it as its own safe category rather than failing readiness on
    // a check that was only ever meant to be a bonus signal on top of the
    // real DB-connectivity check above, which already passed.
    checks.migrations = 'unknown';
  }

  if (checks.migrations === 'unhealthy') {
    return res.status(503).json({ status: 'not_ready', service: 'cdc-api', checks });
  }

  res.status(200).json({ status: 'ready', service: 'cdc-api', checks });
});

export default router;
