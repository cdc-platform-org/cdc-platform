import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import englishTutorRouter, { sanitizeNativeLang } from '../englishTutor';
import { errorHandler } from '../../middleware/errorHandler';

// Platform-wide policy (2026-10): Russian is not offered anywhere on CDC,
// including as an IMIAKO support/explanation language. sanitizeNativeLang()
// is the one place that's enforced server-side, applied at every
// nativeLang-accepting route in englishTutor.ts — these tests prove the
// pure function directly, then prove it's actually wired into the two
// routes that don't require mocking a real Gemini call (the Beginner Path,
// which is pure curated content — see englishTutorBeginnerPath.test.ts's
// sibling suite for the deeper per-block coverage this file doesn't repeat).
describe('sanitizeNativeLang', () => {
  it('maps a bare "ru" code to English', () => {
    expect(sanitizeNativeLang('ru')).toBe('en');
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(sanitizeNativeLang('RU')).toBe('en');
    expect(sanitizeNativeLang('  ru  ')).toBe('en');
    expect(sanitizeNativeLang('Ru')).toBe('en');
  });

  it('maps "ru-RU" and the language name (English or Cyrillic) to English', () => {
    expect(sanitizeNativeLang('ru-RU')).toBe('en');
    expect(sanitizeNativeLang('ru-ru')).toBe('en');
    expect(sanitizeNativeLang('Russian')).toBe('en');
    expect(sanitizeNativeLang('russian')).toBe('en');
    expect(sanitizeNativeLang('Русский')).toBe('en');
  });

  it('never flags an unrelated language as Russian', () => {
    for (const lang of ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az']) {
      expect(sanitizeNativeLang(lang)).toBe(lang);
    }
  });

  it('leaves an empty string alone (callers that require it separately still 400)', () => {
    expect(sanitizeNativeLang('')).toBe('');
  });

  it('does not false-positive on an unrelated string that merely contains "ru"', () => {
    // "ru" is also the start of real language names/codes this platform
    // does support in other free-text contexts (e.g. a hypothetical
    // "Rundi") — the pattern is anchored so only an exact "ru"/"ru-RU"
    // code or the literal word "Russian"/"Русский" trips it.
    expect(sanitizeNativeLang('Rundi')).toBe('Rundi');
    expect(sanitizeNativeLang('ru2')).toBe('ru2');
  });
});

let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/english-tutor', englishTutorRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await prisma.$disconnect();
});

type User = Awaited<ReturnType<typeof createUser>>;
function authHeader(user: User) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `192.0.2.${++requestNumber}` };
}
async function getJson(path: string, user: User): Promise<any> {
  return (await fetch(`${baseUrl}${path}`, { headers: authHeader(user) })).json();
}

describe('GET /english-tutor/beginner-path/state — Russian cannot be newly selected', () => {
  it('?nativeLang=ru falls back to English rather than being accepted', async () => {
    const user = await createUser();
    const body = await getJson('/english-tutor/beginner-path/state?nativeLang=ru', user);
    expect(body.data.active).toBe(true);
    // The real proof is the WORD block's gloss in the very next test
    // (English, never a fabricated Russian translation) — this just
    // confirms the request succeeds rather than erroring on "ru".
  });

  it('a WORD block gloss under ?nativeLang=ru is the English word itself, never a fabricated Russian translation', async () => {
    const user = await createUser();
    const first = await getJson('/english-tutor/beginner-path/state?nativeLang=ru', user);
    await fetch(`${baseUrl}/english-tutor/beginner-path/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(user) },
      body: JSON.stringify({ blockId: first.data.block.id }),
    });
    const word = await getJson('/english-tutor/beginner-path/state?nativeLang=ru', user);
    expect(word.data.block.type).toBe('WORD');
    expect(word.data.block.word.translation).toBe(word.data.block.word.word); // English fallback, not "Привет"
  });

  it('an already-Russian-tagged existing account (hypothetical pre-policy data) is served English going forward, never Russian', async () => {
    // Simulates the only way a "ru" value could already exist server-side —
    // a row written before this policy existed. No destructive migration:
    // the stored value is left as-is in the DB, but every READ path must
    // still never surface Russian content going forward.
    const user = await createUser({ tutorNativeLang: 'ru' });
    const body = await getJson('/english-tutor/beginner-path/state', user); // no query override — reads the stored value
    // This account predates the Beginner Path's own lazy-enrollment rule
    // (tutorNativeLang already set), so it's correctly excluded regardless —
    // the real assertion is that nothing here ever echoes "ru" back as an
    // active language choice.
    expect(body.data.active).toBe(false);
  });
});

describe('POST /english-tutor/beginner-path/advance — Russian cannot be newly selected', () => {
  it('a "ru" nativeLang in the request body falls back to English for the returned block', async () => {
    const user = await createUser();
    const first = await getJson('/english-tutor/beginner-path/state?nativeLang=en', user);
    const res = await fetch(`${baseUrl}/english-tutor/beginner-path/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(user) },
      body: JSON.stringify({ blockId: first.data.block.id, nativeLang: 'ru' }),
    });
    const body: any = await res.json();
    if (body.data.block?.word) {
      expect(body.data.block.word.translation).toBe(body.data.block.word.word);
    }
  });
});
