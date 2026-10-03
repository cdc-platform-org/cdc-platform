import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma } from '../../lib/prisma';

// Phase 19 production deployment safety — these three endpoints must never
// touch a real database or external provider during this suite. The whole
// point of /api/ready's test coverage is proving its behavior when the
// database is NOT reachable, which requires a controllable mock, not a
// real Postgres connection (unlike most of this codebase's route tests).
jest.mock('../../lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }));

import systemRoutes from '../system';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api', systemRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns 200 with a safe, minimal body — no DB, no auth', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', service: 'cdc-api' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('GET /api/version', () => {
  it('returns the expected safe fields, never a secret', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; version: string; commitSha: string; environment: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('cdc-api');
    expect(typeof body.version).toBe('string');
    expect(typeof body.commitSha).toBe('string');
    expect(typeof body.environment).toBe('string');
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/key|secret|token|password|database_url/);
  });

  it('reports commitSha from GIT_COMMIT_SHA, never derived from the request', async () => {
    const original = process.env.GIT_COMMIT_SHA;
    process.env.GIT_COMMIT_SHA = 'abc1234deadbeef0000000000000000000000ff';
    try {
      const res = await fetch(`${baseUrl}/api/version?commitSha=attacker-supplied`);
      const body = (await res.json()) as { commitSha: string };
      expect(body.commitSha).toBe('abc1234deadbeef0000000000000000000000ff');
    } finally {
      if (original === undefined) delete process.env.GIT_COMMIT_SHA;
      else process.env.GIT_COMMIT_SHA = original;
    }
  });
});

describe('GET /api/ready', () => {
  it('returns 200 ready when the database and migrations are both healthy', async () => {
    jest.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(undefined as never) // SELECT 1
      .mockResolvedValueOnce([{ count: 0n }] as never); // no stuck migrations

    const res = await fetch(`${baseUrl}/api/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ready', service: 'cdc-api', checks: { database: 'ok', migrations: 'ok' } });
  });

  it('returns 503 when the database is unavailable — never leaks DATABASE_URL/credentials/a raw stack trace', async () => {
    jest.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432 user=prod_admin password=hunter2'));

    const res = await fetch(`${baseUrl}/api/ready`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: 'not_ready', service: 'cdc-api', checks: { database: 'unavailable', migrations: 'unknown' } });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|password|hunter2/);
  });

  it('returns 503 when a migration started but never finished', async () => {
    jest.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(undefined as never) // SELECT 1 succeeds
      .mockResolvedValueOnce([{ count: 1n }] as never); // one stuck migration

    const res = await fetch(`${baseUrl}/api/ready`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: 'not_ready', service: 'cdc-api', checks: { database: 'ok', migrations: 'unhealthy' } });
  });

  it('does not fail readiness when only the migrations-table check itself errors (DB connectivity already proven)', async () => {
    jest.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(undefined as never) // SELECT 1 succeeds
      .mockRejectedValueOnce(new Error('relation "_prisma_migrations" does not exist'));

    const res = await fetch(`${baseUrl}/api/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ready', service: 'cdc-api', checks: { database: 'ok', migrations: 'unknown' } });
  });
});
