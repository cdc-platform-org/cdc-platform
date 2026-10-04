import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import englishTutorRouter from '../englishTutor';
import { errorHandler } from '../../middleware/errorHandler';

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
function get(path: string, user: User) {
  return fetch(`${baseUrl}${path}`, { headers: authHeader(user) });
}
function post(path: string, user: User, body: unknown = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(user) },
    body: JSON.stringify(body),
  });
}
// Response bodies here are test-only, loosely-shaped JSON (state objects
// that vary by block type) — a concrete type per call site would be pure
// noise, so this one `any` boundary is deliberate, same posture as this
// codebase's other route tests casting `await res.json()` ad hoc.
async function getJson(path: string, user: User): Promise<any> {
  return (await get(path, user)).json();
}
async function postJson(path: string, user: User, body: unknown = {}): Promise<any> {
  return (await post(path, user, body)).json();
}

// A real zero-beginner never has tutorNativeLang set yet — matches
// createUser()'s factory default (null) unless overridden.
async function newBeginner() {
  return createUser();
}

describe('GET /english-tutor/beginner-path/state', () => {
  it('a brand-new user (never generated a lesson) is lazily enrolled and starts at the Greetings stage, block 0', async () => {
    const user = await newBeginner();
    const body = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    expect(body.data.active).toBe(true);
    expect(body.data.stageId).toBe('greetings');
    expect(body.data.blockIndex).toBe(0);
    expect(body.data.isLastStage).toBe(false); // greetings -> introductions still to come
    // The very first thing shown must NOT be a long reading passage — this
    // is the exact regression the whole feature exists to prevent.
    expect(body.data.block.type).not.toBe('READING');
    expect(['GREETING', 'WORD', 'SENTENCE']).toContain(body.data.block.type);
  });

  it('reports isLastStage: true once on the final (introductions) stage', async () => {
    const user = await newBeginner();
    await prisma.userTutorBeginnerProgress.create({ data: { userId: user.id, currentStageId: 'introductions', currentBlockIndex: 0 } });
    const body = await getJson('/english-tutor/beginner-path/state?nativeLang=en', user);
    expect(body.data.stageId).toBe('introductions');
    expect(body.data.isLastStage).toBe(true);
  });

  it('localizes a WORD block gloss for a curated nativeLang', async () => {
    const user = await newBeginner();
    // Advance past the GREETING block to reach the first WORD block (hello).
    // nativeLang is passed explicitly on every call here rather than relying
    // on the route's fire-and-forget User.tutorNativeLang persistence (same
    // "convenience write, never blocks the response" posture as POST
    // /lessons/generate) to have landed before the next read — that would
    // make this test racy, not the feature itself.
    const first = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    await post('/english-tutor/beginner-path/advance', user, { blockId: first.data.block.id });
    const body = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    expect(body.data.block.type).toBe('WORD');
    expect(body.data.block.word.translation).toBe('გამარჯობა');
  });

  it('an existing user (tutorNativeLang already set) is never retroactively enrolled', async () => {
    const user = await createUser({ tutorNativeLang: 'ka' });
    const body = await getJson('/english-tutor/beginner-path/state', user);
    expect(body.data.active).toBe(false);
    const stored = await prisma.userTutorBeginnerProgress.findUnique({ where: { userId: user.id } });
    expect(stored).toBeNull();
  });

  it('requires authentication', async () => {
    const res = await fetch(`${baseUrl}/english-tutor/beginner-path/state`);
    expect(res.status).toBe(401);
  });
});

describe('POST /english-tutor/beginner-path/advance — WRITE blocks', () => {
  async function advanceToFirstWriteBlock(user: User): Promise<any> {
    let state = await getJson('/english-tutor/beginner-path/state?nativeLang=en', user);
    for (let i = 0; i < 20 && state.data.block.type !== 'WRITE'; i++) {
      state = await postJson('/english-tutor/beginner-path/advance', user, { blockId: state.data.block.id });
    }
    return state;
  }

  it('an incorrect answer does not advance the block', async () => {
    const user = await newBeginner();
    const state = await advanceToFirstWriteBlock(user);
    expect(state.data.block.type).toBe('WRITE');
    const blockIdBefore = state.data.block.id;

    const body = await postJson('/english-tutor/beginner-path/advance', user, { blockId: blockIdBefore, responseText: 'Goodbye' });
    expect(body.data.correct).toBe(false);
    expect(body.data.block.id).toBe(blockIdBefore); // did not move on
  });

  it('a correct answer (case/whitespace-insensitive) advances to the next block', async () => {
    const user = await newBeginner();
    const state = await advanceToFirstWriteBlock(user);
    const blockIdBefore = state.data.block.id;

    const body = await postJson('/english-tutor/beginner-path/advance', user, { blockId: blockIdBefore, responseText: '  hello  ' });
    expect(body.data.correct).toBe(true);
    expect(body.data.block.id).not.toBe(blockIdBefore);

    const stored = await prisma.userTutorBeginnerProgress.findUnique({ where: { userId: user.id } });
    expect(stored!.masteredConceptIds).toContain(blockIdBefore);
  });

  it('a stale/replayed blockId is a safe no-op, never skipping ahead', async () => {
    const user = await newBeginner();
    const first = await getJson('/english-tutor/beginner-path/state?nativeLang=en', user);
    const firstBlockId = first.data.block.id;
    await post('/english-tutor/beginner-path/advance', user, { blockId: firstBlockId }); // real advance
    const afterReal = await getJson('/english-tutor/beginner-path/state', user);

    // Replay the OLD blockId again.
    const replay = await postJson('/english-tutor/beginner-path/advance', user, { blockId: firstBlockId });
    expect(replay.data.block.id).toBe(afterReal.data.block.id); // unchanged — no further skip
  });
});

describe('POST /english-tutor/beginner-path/advance — QUESTION_NAME personalization', () => {
  it('saving a display name personalizes later PERSONAL_SENTENCE blocks', async () => {
    const user = await newBeginner();
    // Walk forward until we hit the name question, answering WRITE blocks
    // correctly along the way using the server's own current block text
    // (Hello) — the only WRITE block before the name question is write:hello.
    let state = await getJson('/english-tutor/beginner-path/state?nativeLang=en', user);
    for (let i = 0; i < 30 && state.data.block.type !== 'QUESTION_NAME'; i++) {
      const body: Record<string, unknown> = { blockId: state.data.block.id };
      if (state.data.block.type === 'WRITE') body.responseText = 'Hello';
      state = await postJson('/english-tutor/beginner-path/advance', user, body);
    }
    expect(state.data.block.type).toBe('QUESTION_NAME');

    const named = await postJson('/english-tutor/beginner-path/advance', user, { blockId: state.data.block.id, displayName: 'Nino' });
    expect(named.data.learnerDisplayName).toBe('Nino');
    expect(named.data.block.type).toBe('PERSONAL_SENTENCE');
    expect(named.data.block.textEn).toBe('I am Nino.');
  });
});

// Changing the support/native language is a pure rendering-time choice —
// nativeLang is passed into serializeBeginnerState as a parameter, never
// read from or written into the stored UserTutorBeginnerProgress row
// (stageId/blockIndex/masteredConceptIds/learnerDisplayName). These tests
// prove that explicitly rather than just by code inspection: switching
// language mid-path must never reset progress, level, or personalization.
describe('changing support/native language mid-path', () => {
  it('switching from one curated language to another re-renders the SAME block, only the gloss changes', async () => {
    const user = await newBeginner();
    const ka = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    await post('/english-tutor/beginner-path/advance', user, { blockId: ka.data.block.id }); // past GREETING -> WORD "hello"

    const kaWord = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    const ukWord = await getJson('/english-tutor/beginner-path/state?nativeLang=uk', user);

    expect(kaWord.data.stageId).toBe(ukWord.data.stageId);
    expect(kaWord.data.blockIndex).toBe(ukWord.data.blockIndex);
    expect(kaWord.data.block.id).toBe(ukWord.data.block.id);
    expect(kaWord.data.block.word.word).toBe(ukWord.data.block.word.word); // the English target word never changes
    expect(kaWord.data.block.word.translation).toBe('გამარჯობა');
    expect(ukWord.data.block.word.translation).toBe('Привіт');
    expect(kaWord.data.block.word.translation).not.toBe(ukWord.data.block.word.translation);
  });

  it('does not reset mastered concepts or the learner name when the language changes', async () => {
    const user = await newBeginner();
    let state = await getJson('/english-tutor/beginner-path/state?nativeLang=ka', user);
    for (let i = 0; i < 30 && state.data.block.type !== 'QUESTION_NAME'; i++) {
      const body: Record<string, unknown> = { blockId: state.data.block.id };
      if (state.data.block.type === 'WRITE') body.responseText = 'Hello';
      state = await postJson('/english-tutor/beginner-path/advance', user, body);
    }
    await postJson('/english-tutor/beginner-path/advance', user, { blockId: state.data.block.id, displayName: 'Nino' });

    const before = await prisma.userTutorBeginnerProgress.findUniqueOrThrow({ where: { userId: user.id } });

    // Switch language (simulates the learner changing support language from
    // the settings control) — a plain GET in the new language, nothing else.
    const afterLangSwitch = await getJson('/english-tutor/beginner-path/state?nativeLang=uk', user);

    const after = await prisma.userTutorBeginnerProgress.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.currentStageId).toBe(before.currentStageId);
    expect(after.currentBlockIndex).toBe(before.currentBlockIndex);
    expect(after.masteredConceptIds).toEqual(before.masteredConceptIds);
    expect(after.learnerDisplayName).toBe('Nino'); // personalization survives the language switch
    expect(afterLangSwitch.data.block.type).toBe('PERSONAL_SENTENCE');
    expect(afterLangSwitch.data.block.textEn).toBe('I am Nino.'); // English target content unchanged
  });

  it('an uncurated nativeLang falls back to English rather than fabricating a translation', async () => {
    const user = await newBeginner();
    const first = await getJson('/english-tutor/beginner-path/state?nativeLang=sw', user); // Swahili — not in the curated set
    await post('/english-tutor/beginner-path/advance', user, { blockId: first.data.block.id });
    const word = await getJson('/english-tutor/beginner-path/state?nativeLang=sw', user);
    expect(word.data.block.word.translation).toBe(word.data.block.word.word); // no fabricated gloss
  });
});

describe('POST /english-tutor/beginner-path/skip', () => {
  it('marks the path skipped and the state becomes inactive', async () => {
    const user = await newBeginner();
    await get('/english-tutor/beginner-path/state', user); // lazily enroll
    const body = await postJson('/english-tutor/beginner-path/skip', user);
    expect(body.data.active).toBe(false);
    expect(body.data.skippedAt).toBeTruthy();

    const after = await getJson('/english-tutor/beginner-path/state', user);
    expect(after.data.active).toBe(false);
  });

  it('is safe to call even for a user with no existing progress row', async () => {
    const user = await newBeginner();
    const res = await post('/english-tutor/beginner-path/skip', user);
    expect(res.status).toBe(200);
  });
});

describe('an already-completed path never re-personalizes or re-advances', () => {
  it('advance is a no-op once completedAt is set', async () => {
    const user = await newBeginner();
    await prisma.userTutorBeginnerProgress.create({
      data: { userId: user.id, currentStageId: 'introductions', currentBlockIndex: 0, completedAt: new Date() },
    });
    const body = await postJson('/english-tutor/beginner-path/advance', user, { blockId: 'sentence:i-am-imiako' });
    expect(body.data.active).toBe(false);
  });
});
