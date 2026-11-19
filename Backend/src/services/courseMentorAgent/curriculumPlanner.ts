/**
 * Course Mentor Agent — the curriculum planner (stage 1's core).
 * Exports: startCoursePlanning, runCoursePlanning, normalizeLessonCount, parseModelJson.
 *
 * Two AI passes plus deterministic glue:
 *  1. "Architect": reads each document's table of contents + opening text and
 *     returns modules in teaching order with relative weights.
 *  2. calendar.ts turns the teacher's dates into class days and splits them
 *     across modules by weight (exact, never left to the model).
 *  3. "Lesson designer": per module (in batches of LESSON_BATCH), retrieves the
 *     relevant source passages and plans exactly the allotted lessons.
 * Then everything is written in one transaction with real dates.
 * Prompts: prompts/plannerPrompts.ts. Model calls go through the platform's
 * shared fallback chain (aiAgentService.callTextModel: Azure OpenAI primary ->
 * secondary region -> Gemini).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { callTextModel } from '../ai/aiAgentService';
import { allocateLessonsToModules, isoDate, listClassDays } from './calendar';
import { searchCourseChunks } from './retrieval';
import {
  buildCurriculumPrompt,
  buildModuleLessonsPrompt,
  DocumentOutlineForPrompt,
} from './prompts/plannerPrompts';
import {
  CourseBrief,
  CourseMentorError,
  CurriculumDraft,
  curriculumDraftSchema,
  LessonBlueprint,
  moduleLessonsSchema,
  OutlineEntry,
} from './types';
import { z } from 'zod';

const LESSON_BATCH = 8;
const MODULE_CONCURRENCY = 3;
const MAX_HEADINGS_IN_PROMPT = 700;
const EXCERPT_CHARS = 1400;
const MAX_EXCERPTS = 8;

// ---------- small helpers (exported for tests) ----------

// Models occasionally wrap JSON in ```json fences or add a sentence; take
// the outermost object and validate it.
export function parseModelJson<T>(raw: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Model did not return JSON.');
  return schema.parse(JSON.parse(raw.slice(start, end + 1)));
}

// The model is asked for an exact number of lessons but may return a few
// more or fewer. Extra lessons are dropped; missing ones become practice /
// review days built from the module's own lessons, so the calendar stays
// exactly as the teacher set it.
export function normalizeLessonCount(
  lessons: LessonBlueprint[],
  wanted: number,
  moduleTitle: string,
  closesModule = true
): LessonBlueprint[] {
  if (lessons.length >= wanted) return lessons.slice(0, wanted);
  const out = [...lessons];
  const base = lessons.length ? lessons : null;
  for (let i = out.length; i < wanted; i++) {
    const src = base ? base[i % base.length] : null;
    out.push({
      kind: closesModule && i === wanted - 1 && wanted >= 4 ? 'ASSESSMENT' : 'PRACTICE',
      title: src ? `${src.title} — practice` : `${moduleTitle} — practice`,
      summary: src?.summary ?? moduleTitle,
      objectives: src?.objectives ?? [moduleTitle],
      topics: src?.topics ?? [moduleTitle],
      flow: src?.flow ?? [{ step: 'Review', minutes: 30 }, { step: 'Practice', minutes: 30 }],
      realWorldExample: src?.realWorldExample ?? moduleTitle,
      practiceIdeas: src?.practiceIdeas ?? [{ type: 'quiz', description: moduleTitle, difficulty: 'medium' }],
      homework: src?.homework ?? { description: moduleTitle, deliverable: '-' },
      sourceHeadings: src?.sourceHeadings ?? [],
    });
  }
  return out;
}

const normalizeHeading = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

async function callJson<T>(prompt: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, maxOutputTokens: number): Promise<T> {
  let lastErr: unknown;
  // One extra attempt on malformed/invalid JSON — the transport layer
  // already retries provider errors (region failover, Gemini fallback).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callTextModel(prompt, attempt === 0 ? 0.4 : 0.2, undefined, { maxOutputTokens, timeoutMs: 180_000 });
      return parseModelJson(raw, schema);
    } catch (err) {
      lastErr = err;
      console.warn('[courseMentor/planner] model call failed, attempt', attempt + 1, (err as Error).message);
    }
  }
  throw lastErr;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function setProgress(courseId: string, step: string, done: number, total: number) {
  await prisma.mentorCourse.update({ where: { id: courseId }, data: { planProgress: { step, done, total } } }).catch(() => undefined);
}

// ---------- entry points ----------

// Validates, flips the course to PLANNING and runs the planner in the
// background. The teacher's page polls GET /courses/:id for progress.
export async function startCoursePlanning(courseId: string): Promise<void> {
  const course = await prisma.mentorCourse.findUnique({
    where: { id: courseId },
    include: { documents: { select: { status: true } } },
  });
  if (!course) throw new CourseMentorError(404, 'Course not found.');
  if (course.status === 'PLANNING') throw new CourseMentorError(409, 'The plan is already being generated.', 'ALREADY_PLANNING');
  if (course.documents.some((d) => d.status === 'PROCESSING')) {
    throw new CourseMentorError(409, 'Documents are still being processed. Try again in a minute.', 'DOCUMENTS_PROCESSING');
  }
  if (!course.documents.some((d) => d.status === 'READY')) {
    throw new CourseMentorError(400, 'Upload at least one document first.', 'NO_DOCUMENTS');
  }
  const days = listClassDays(course.startDate, course.endDate, course.weekdays, course.excludedDates);
  if (days.length === 0) throw new CourseMentorError(400, 'The calendar has no class days.', 'NO_CLASS_DAYS');

  await prisma.mentorCourse.update({
    where: { id: courseId },
    data: { status: 'PLANNING', planError: null, planProgress: { step: 'structure', done: 0, total: 1 } },
  });
  setImmediate(() => {
    runCoursePlanning(courseId).catch((err) => console.error('[courseMentor/planner] unexpected failure', courseId, err));
  });
}

export async function runCoursePlanning(courseId: string): Promise<void> {
  try {
    const course = await prisma.mentorCourse.findUniqueOrThrow({
      where: { id: courseId },
      include: { documents: { where: { status: 'READY' }, orderBy: { createdAt: 'asc' } } },
    });
    const classDays = listClassDays(course.startDate, course.endDate, course.weekdays, course.excludedDates);
    const brief: CourseBrief = {
      title: course.title,
      audience: course.audience,
      goals: course.goals,
      instructions: course.instructions,
      teachingLocale: course.teachingLocale,
      minutesPerLesson: course.minutesPerLesson,
      taskTypes: course.taskTypes,
      totalLessons: classDays.length,
      startDate: isoDate(course.startDate),
      endDate: isoDate(course.endDate),
    };

    // ---- pass 1: module structure ----
    const totalHeadings = course.documents.reduce((n, d) => n + ((d.outline as OutlineEntry[] | null)?.length ?? 0), 0);
    const headingBudget = (len: number) => Math.max(15, Math.floor((len / Math.max(1, totalHeadings)) * MAX_HEADINGS_IN_PROMPT));
    const docsForPrompt: DocumentOutlineForPrompt[] = await Promise.all(
      course.documents.map(async (d, i) => {
        const outline = (d.outline as OutlineEntry[] | null) ?? [];
        const first = await prisma.mentorSourceChunk.findFirst({ where: { documentId: d.id }, orderBy: { position: 'asc' }, select: { content: true } });
        return {
          number: i + 1,
          filename: d.filename,
          headings: outline.slice(0, headingBudget(outline.length)).map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}${h.title}`),
          opening: (first?.content ?? '').slice(0, 1200),
        };
      })
    );
    const draft: CurriculumDraft = await callJson(buildCurriculumPrompt(brief, docsForPrompt), curriculumDraftSchema, 6000);

    // More modules than class days (tiny calendars): keep the first ones.
    const modules = draft.modules.slice(0, classDays.length);
    const counts = allocateLessonsToModules(modules.map((m) => m.weight), classDays.length);

    // ---- pass 2: lessons per module ----
    let firstLesson = 1;
    const moduleStarts = counts.map((c) => {
      const start = firstLesson;
      firstLesson += c;
      return start;
    });
    let batchesDone = 0;
    const totalBatches = counts.reduce((n, c) => n + Math.ceil(c / LESSON_BATCH), 0);
    await setProgress(courseId, 'lessons', 0, totalBatches);

    const plannedModules = await mapPool(modules, MODULE_CONCURRENCY, async (mod, mi) => {
      // Source passages: the sections the architect named, then semantic /
      // keyword search on the module itself to fill gaps.
      const named: { id: string; heading: string | null; content: string }[] = [];
      for (const src of mod.sources) {
        const doc = course.documents[src.document - 1];
        if (!doc) continue;
        const outline = (doc.outline as OutlineEntry[] | null) ?? [];
        const positions = src.headings
          .map((h) => outline.find((o) => normalizeHeading(o.title) === normalizeHeading(h))?.chunkPosition)
          .filter((p): p is number => typeof p === 'number');
        if (positions.length === 0) continue;
        const rows = await prisma.mentorSourceChunk.findMany({
          where: { documentId: doc.id, position: { in: [...new Set(positions.flatMap((p) => [p, p + 1]))] } },
          select: { id: true, heading: true, content: true },
          orderBy: { position: 'asc' },
        });
        named.push(...rows);
      }
      const searched = await searchCourseChunks(courseId, `${mod.title}\n${mod.summary}\n${mod.skills.join(' ')}`, { limit: 6 });
      const seen = new Set<string>();
      const excerpts = [...named, ...searched]
        .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
        .slice(0, MAX_EXCERPTS);

      const lessons: LessonBlueprint[] = [];
      for (let offset = 0; offset < counts[mi]; offset += LESSON_BATCH) {
        const size = Math.min(LESSON_BATCH, counts[mi] - offset);
        const prompt = buildModuleLessonsPrompt(brief, {
          moduleNumber: mi + 1,
          moduleCount: modules.length,
          title: mod.title,
          summary: mod.summary,
          skills: mod.skills,
          previousModules: modules.slice(0, mi).map((m) => m.title),
          nextModule: modules[mi + 1]?.title ?? null,
          firstLessonNumber: moduleStarts[mi] + offset,
          lessonCount: size,
          moduleLessonTotal: counts[mi],
          alreadyPlanned: lessons.map((l) => l.title),
          excerpts: excerpts.map((e) => ({ heading: e.heading, text: e.content.slice(0, EXCERPT_CHARS) })),
        });
        const batch = await callJson(prompt, moduleLessonsSchema, 9000);
        lessons.push(...normalizeLessonCount(batch.lessons, size, mod.title, offset + size >= counts[mi]));
        batchesDone++;
        await setProgress(courseId, 'lessons', batchesDone, totalBatches);
      }

      // Map each lesson's cited headings back to chunk ids for stage 2.
      const withSources = lessons.map((l) => {
        const wanted = new Set(l.sourceHeadings.map(normalizeHeading));
        const ids = excerpts.filter((e) => e.heading && wanted.has(normalizeHeading(e.heading))).map((e) => e.id);
        return { lesson: l, chunkIds: ids.length ? ids : excerpts.slice(0, 3).map((e) => e.id) };
      });
      return { mod, lessons: withSources };
    });

    // ---- save: replace any previous plan atomically ----
    let position = 0;
    await prisma.$transaction(
      async (tx) => {
        await tx.mentorLesson.deleteMany({ where: { courseId } });
        await tx.mentorModule.deleteMany({ where: { courseId } });
        for (let mi = 0; mi < plannedModules.length; mi++) {
          const { mod, lessons } = plannedModules[mi];
          const created = await tx.mentorModule.create({
            data: { courseId, position: mi + 1, title: mod.title, summary: mod.summary, weight: mod.weight },
            select: { id: true },
          });
          await tx.mentorLesson.createMany({
            data: lessons.map(({ lesson, chunkIds }) => {
              const date = classDays[position];
              position++;
              const { kind, title, objectives, topics, ...plan } = lesson;
              return {
                courseId,
                moduleId: created.id,
                position,
                date,
                kind,
                title,
                objectives,
                topics,
                plan: plan as unknown as Prisma.InputJsonValue,
                sourceChunkIds: chunkIds,
              };
            }),
          });
        }
        await tx.mentorCourse.update({
          where: { id: courseId },
          data: {
            status: 'PLAN_READY',
            planError: null,
            planProgress: Prisma.DbNull,
            planGeneratedAt: new Date(),
            planSummary: { courseSummary: draft.courseSummary, notesForTeacher: draft.notesForTeacher },
          },
        });
      },
      { timeout: 60_000 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[courseMentor/planner] failed', courseId, message);
    await prisma.mentorCourse
      .update({ where: { id: courseId }, data: { status: 'PLAN_FAILED', planError: message.slice(0, 1000), planProgress: Prisma.DbNull } })
      .catch(() => undefined);
  }
}
