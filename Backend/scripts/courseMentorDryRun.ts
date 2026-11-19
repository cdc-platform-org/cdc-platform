/**
 * Dev tool — try the Course Mentor planner on local files without a database.
 *
 *   npx ts-node --transpile-only scripts/courseMentorDryRun.ts <out.json> <file1> [file2 ...]
 *
 * Runs the real pipeline pieces (parse -> legacy-font repair -> chunks ->
 * outline -> curriculum prompt -> calendar allocation) and plans the FIRST
 * batch of lessons of the first two modules, to keep the AI cost small.
 * Uses the AI credentials from Backend/.env. Writes the result to out.json.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parseDocumentToMarkdown } from '../src/services/ai/documentParserService';
import { callTextModel } from '../src/services/ai/aiAgentService';
import { cleanExtractedText, chunkWithHeadings, buildOutline } from '../src/services/courseMentorAgent/textProcessing';
import { repairLegacyGeorgianText } from '../src/services/courseMentorAgent/legacyGeorgianFont';
import { allocateLessonsToModules, isoDate, listClassDays, parseIsoDate } from '../src/services/courseMentorAgent/calendar';
import { buildCurriculumPrompt, buildModuleLessonsPrompt } from '../src/services/courseMentorAgent/prompts/plannerPrompts';
import { curriculumDraftSchema, moduleLessonsSchema, CourseBrief } from '../src/services/courseMentorAgent/types';
import { parseModelJson, normalizeLessonCount } from '../src/services/courseMentorAgent/curriculumPlanner';

async function main() {
  const [outFile, ...files] = process.argv.slice(2);
  if (!outFile || files.length === 0) throw new Error('usage: courseMentorDryRun.ts <out.json> <files...>');

  const docs = [];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const name = path.basename(f);
    const parsed = await parseDocumentToMarkdown(buf, f.endsWith('.pdf') ? 'application/pdf' : 'text/plain', name);
    const { text } = repairLegacyGeorgianText(cleanExtractedText(parsed));
    const chunks = chunkWithHeadings(text);
    docs.push({ name, chunks, outline: buildOutline(text, chunks) });
    console.log(`parsed ${name}: ${chunks.length} chunks, ${docs[docs.length - 1].outline.length} headings`);
  }

  const start = '2026-09-15';
  const end = '2027-06-30';
  const days = listClassDays(parseIsoDate(start), parseIsoDate(end), [1, 2, 3, 4, 5]);
  const brief: CourseBrief = {
    title: 'Full-stack ვებ დეველოპმენტი',
    audience: 'პროფესიული კოლეჯის სტუდენტები, პროგრამირების საწყისი დონე',
    goals: 'კურსის ბოლოს სტუდენტი მუშაობს როგორც junior Full-stack დეველოპერი: აწყობს ვებ ინტერფეისს და სერვერულ ნაწილს, მუშაობს ბაზებთან',
    instructions: 'ასწავლე როგორც პროფესიონალმა Full-stack დეველოპერმა, რეალურ მაგალითებზე',
    teachingLocale: 'ka',
    minutesPerLesson: 180,
    taskTypes: [],
    totalLessons: days.length,
    startDate: start,
    endDate: end,
  };

  const prompt = buildCurriculumPrompt(
    brief,
    docs.map((d, i) => ({
      number: i + 1,
      filename: d.name,
      headings: d.outline.slice(0, 160).map((h) => `${'  '.repeat(h.level - 1)}${h.title}`),
      opening: d.chunks[0]?.content.slice(0, 1200) ?? '',
    }))
  );
  console.log(`curriculum prompt: ${prompt.length} chars, ${days.length} class days`);
  const t0 = Date.now();
  const draft = parseModelJson(await callTextModel(prompt, 0.4, undefined, { maxOutputTokens: 6000, timeoutMs: 180_000 }), curriculumDraftSchema);
  console.log(`modules: ${draft.modules.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
  const counts = allocateLessonsToModules(draft.modules.map((m) => m.weight), days.length);

  const sample = [];
  let first = 1;
  for (let mi = 0; mi < Math.min(2, draft.modules.length); mi++) {
    const mod = draft.modules[mi];
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const excerpts = mod.sources.flatMap((s) => {
      const d = docs[s.document - 1];
      if (!d) return [];
      return s.headings.flatMap((h) => {
        const o = d.outline.find((x) => norm(x.title) === norm(h));
        const c = o ? d.chunks[o.chunkPosition] : undefined;
        return c ? [{ heading: c.heading, text: c.content.slice(0, 1400) }] : [];
      });
    }).slice(0, 8);
    const size = Math.min(8, counts[mi]);
    const t1 = Date.now();
    const raw = await callTextModel(
      buildModuleLessonsPrompt(brief, {
        moduleNumber: mi + 1, moduleCount: draft.modules.length, title: mod.title, summary: mod.summary, skills: mod.skills,
        previousModules: draft.modules.slice(0, mi).map((m) => m.title), nextModule: draft.modules[mi + 1]?.title ?? null,
        firstLessonNumber: first, lessonCount: size, moduleLessonTotal: counts[mi], alreadyPlanned: [], excerpts,
      }),
      0.4, undefined, { maxOutputTokens: 9000, timeoutMs: 180_000 }
    );
    const lessons = normalizeLessonCount(parseModelJson(raw, moduleLessonsSchema).lessons, size, mod.title);
    console.log(`module ${mi + 1}: ${excerpts.length} excerpts, ${lessons.length} lessons (${Math.round((Date.now() - t1) / 1000)}s)`);
    sample.push({ module: mod.title, lessons: lessons.map((l, i) => ({ number: first + i, date: isoDate(days[first + i - 1]), ...l })) });
    first += counts[mi];
  }

  fs.writeFileSync(outFile, JSON.stringify({ classDays: days.length, draft, lessonsPerModule: counts, sample }, null, 2));
  console.log(`written ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
