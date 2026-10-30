import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { prisma } from '../../lib/prisma';
import { createUser } from '../../test/factories';
import authRoutes from '../auth';
import { errorHandler } from '../../middleware/errorHandler';
import { buildPasswordResetEmailContent } from '../../services/emailService';

let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

// Every call gets its own X-Forwarded-For so authRateLimit's IP-keyed budget
// (20 requests / 15 min, see routes/auth.ts) never trips across the several
// forgot-password/reset-password calls this file makes.
function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.7.${++requestNumber}` },
    body: JSON.stringify(body),
  });
}

describe('buildPasswordResetEmailContent — language selection (pure, no I/O)', () => {
  it('lang=ka -> Georgian subject/heading/body/button', () => {
    const { resolvedLang, subject, html } = buildPasswordResetEmailContent('tok', 'ka');
    expect(resolvedLang).toBe('ka');
    expect(subject).toBe('პაროლის აღდგენა — CDC');
    expect(html).toContain('პაროლის აღდგენა'); // heading + button text
    expect(html).toContain('მიღებულია მოთხოვნა თქვენი CDC ანგარიშის პაროლის აღდგენაზე.');
    expect(html).toContain('უსაფრთხოების მიზნით, პაროლის აღდგენის ბმული მოქმედებს შეზღუდული დროით.');
  });

  it('lang=en -> English subject/heading/body/button', () => {
    const { resolvedLang, subject, html } = buildPasswordResetEmailContent('tok', 'en');
    expect(resolvedLang).toBe('en');
    expect(subject).toBe('Reset your password — CDC');
    expect(html).toContain('Reset your password'); // heading
    expect(html).toContain('>Reset password<'); // button label, distinct from the heading
    expect(html).toContain('We received a request to reset the password for your CDC account.');
    expect(html).toContain('For security reasons, this password reset link is valid for a limited time.');
  });

  it('lang=de -> English fallback (no German template exists)', () => {
    const { resolvedLang, subject } = buildPasswordResetEmailContent('tok', 'de');
    expect(resolvedLang).toBe('en');
    expect(subject).toBe('Reset your password — CDC');
  });

  it('lang=tr -> English fallback', () => {
    const { resolvedLang, subject } = buildPasswordResetEmailContent('tok', 'tr');
    expect(resolvedLang).toBe('en');
    expect(subject).toBe('Reset your password — CDC');
  });

  it('lang=undefined -> English fallback (not Georgian)', () => {
    const { resolvedLang, subject } = buildPasswordResetEmailContent('tok', undefined);
    expect(resolvedLang).toBe('en');
    expect(subject).toBe('Reset your password — CDC');
  });

  it('lang=null-like empty string -> English fallback', () => {
    const { resolvedLang } = buildPasswordResetEmailContent('tok', '');
    expect(resolvedLang).toBe('en');
  });

  it('reset link is locale-prefixed for English, unprefixed for Georgian', () => {
    const en = buildPasswordResetEmailContent('abc123', 'en');
    const ka = buildPasswordResetEmailContent('abc123', 'ka');
    expect(en.link).toContain('/en/reset-password?token=abc123');
    expect(ka.link).toMatch(/\/reset-password\?token=abc123$/);
    expect(ka.link).not.toContain('/en/reset-password');
  });
});

describe('forgot-password / reset-password — token & security behavior unchanged', () => {
  it('accepts a non-ka/en site locale without a validation error (schema no longer rejects it)', async () => {
    const user = await createUser();
    const res = await post('/api/auth/forgot-password', { email: user.email, lang: 'de' });
    expect(res.status).toBe(200);
  });

  it('issues a working, one-time reset token end-to-end, and rejects reuse', async () => {
    const user = await createUser();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let forgotRes: Response;
    try {
      forgotRes = await post('/api/auth/forgot-password', { email: user.email, lang: 'ka' });
    } finally {
      // Nothing in this test asserts on the dev-fallback log itself — that's
      // covered separately below — this just needs to extract the token
      // that the (pre-existing, unchanged) dev-mode fallback prints when no
      // RESEND_API_KEY is configured, which is always true in this test env.
      var loggedLines = logSpy.mock.calls.map((args) => args.join(' '));
      logSpy.mockRestore();
    }
    expect(forgotRes.status).toBe(200);

    const devEmailLine = loggedLines.find((line) => line.includes('[DEV EMAIL]') && line.includes(user.email));
    expect(devEmailLine).toBeDefined();
    const tokenMatch = devEmailLine!.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch![1];

    // Token accepted, expiration/ownership checks untouched, password
    // actually changes.
    const resetRes = await post('/api/auth/reset-password', { token: rawToken, password: 'BrandNewPassw0rd!' });
    expect(resetRes.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.passwordResetToken).toBeNull();
    expect(updatedUser?.passwordResetTokenExpires).toBeNull();

    // One-time-use: the same raw token must not work a second time.
    const reuseRes = await post('/api/auth/reset-password', { token: rawToken, password: 'AnotherPassw0rd!' });
    expect(reuseRes.status).toBe(400);
  });

  it('never reveals whether an email is registered (always 200, identical message)', async () => {
    const res = await post('/api/auth/forgot-password', { email: 'definitely-not-a-real-account@cdc.test', lang: 'en' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('If an account exists for that email, a reset link has been sent.');
  });
});

describe('no token logging from the new code path', () => {
  it('a production-mode call with no email provider configured never logs the raw token', async () => {
    const secretToken = `secret-token-${Date.now()}-should-never-appear-in-any-log`;
    const originalEnv = process.env.NODE_ENV;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // isProduction (emailService.ts) is captured once at module load, so a
      // fresh module instance is required to observe the production branch.
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const freshEmailService = require('../../services/emailService');
      await freshEmailService.sendPasswordResetEmail('someone@cdc.test', secretToken, 'ka');

      const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].map((args) => args.join(' ')).join('\n');
      expect(allLoggedText).not.toContain(secretToken);
    } finally {
      process.env.NODE_ENV = originalEnv;
      logSpy.mockRestore();
      errorSpy.mockRestore();
      jest.resetModules();
    }
  });
});
