/**
 * Unit tests for the Course Mentor Agent's deterministic parts (no DB, no AI):
 * calendar, lesson allocation, legacy-font repair, heading/chunk/outline
 * detection, keyword scoring, model-JSON parsing and lesson-count repair.
 */
import { allocateLessonsToModules, listClassDays, parseIsoDate, isoDate } from '../calendar';
import { looksLikeAcadNusxLine, repairLegacyGeorgianText, convertAcadNusxWord } from '../legacyGeorgianFont';
import { cleanExtractedText, detectHeading, chunkWithHeadings, buildOutline } from '../textProcessing';
import { tokenize, cosineSimilarity } from '../retrieval';
import { normalizeLessonCount, parseModelJson } from '../curriculumPlanner';
import { curriculumDraftSchema, LessonBlueprint } from '../types';
import { generateJoinCode } from '../courseService';

jest.mock('../../../lib/prisma', () => ({ prisma: {} }));

describe('calendar', () => {
  it('lists only the chosen weekdays and skips excluded dates', () => {
    // 2026-09-14 is a Monday.
    const days = listClassDays(parseIsoDate('2026-09-14'), parseIsoDate('2026-09-27'), [1, 2, 3, 4, 5], ['2026-09-16']);
    expect(days.map(isoDate)).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-17', '2026-09-18',
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
    ]);
  });

  it('a Sept–June college year with 5 days a week has ~200 class days', () => {
    const days = listClassDays(parseIsoDate('2026-09-15'), parseIsoDate('2027-06-30'), [1, 2, 3, 4, 5]);
    expect(days.length).toBeGreaterThan(200);
    expect(days.length).toBeLessThan(210);
  });

  it('allocates lessons by weight, at least one each, summing exactly', () => {
    const counts = allocateLessonsToModules([1, 3, 6], 20);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
    expect(counts.every((c) => c >= 1)).toBe(true);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[0]);
  });

  it('refuses more modules than class days', () => {
    expect(() => allocateLessonsToModules([1, 1, 1], 2)).toThrow();
  });
});

describe('legacy Georgian font (AcadNusx) repair', () => {
  it('converts AcadNusx text to Unicode Georgian', () => {
    expect(convertAcadNusxWord('saqarTvelos')).toBe('საქართველოს');
    const { text, convertedLines } = repairLegacyGeorgianText('saqarTvelos teqnikuri universiteti\ngela RvinefaZe');
    expect(text).toBe('საქართველოს ტექნიკური უნივერსიტეტი\nგელა ღვინეფაძე');
    expect(convertedLines).toBe(2);
  });

  it('leaves English, code and identifiers alone', () => {
    for (const line of [
      '<div ng-controller="MainCtrl as main">',
      'function MainCtrl (UserService) {',
      'Table: productCode',
      'void setSecure',
      'ServletException, IOException',
      'ShapeCache.java',
      'Count',
      'Field Name Data Type Description',
      'Convert to Shape',
      'უკვე ქართული ტექსტი saqarTvelo',
    ]) {
      expect(looksLikeAcadNusxLine(line)).toBe(false);
    }
  });
});

describe('text processing', () => {
  it('cleans page markers and tabs', () => {
    expect(cleanExtractedText('a\tb\n-- 3 of 59 --\n- 12 -\nc')).toBe('a b\n\nc');
  });

  it('detects TOC lines, chapters and numbered sections but not list items', () => {
    expect(detectHeading('1.1 ვებგვერდის სტრუქტურის აგება ........... 3')).toEqual({ title: '1.1 ვებგვერდის სტრუქტურის აგება', level: 2, fromToc: true });
    expect(detectHeading('1.1 ალგორითმის ცნება.................. - 15 -')?.fromToc).toBe(true);
    expect(detectHeading('თავი 2. საიტის სტილებით გაფორმება - css')?.level).toBe(1);
    expect(detectHeading('2.3.1 ციკლები')?.level).toBe(3);
    expect(detectHeading('1. თუ')).toBeNull();
    expect(detectHeading('## Arrays')).toEqual({ title: 'Arrays', level: 2, fromToc: false });
  });

  it('chunks carry their section heading and the outline points at them', () => {
    const body = 'x'.repeat(900);
    const text = [
      '1.1 შესავალი ........ 3', '1.2 ცვლადები ........ 5', '1.3 ციკლები ........ 8',
      '1.4 ფუნქციები ........ 9', '1.5 მასივები ........ 10',
      '1.1 შესავალი', body, '1.2 ცვლადები', body, '1.3 ციკლები', body,
    ].join('\n');
    const chunks = chunkWithHeadings(text);
    expect(chunks.some((c) => c.heading === '1.2 ცვლადები')).toBe(true);
    const outline = buildOutline(text, chunks);
    expect(outline.map((o) => o.title)).toEqual(['1.1 შესავალი', '1.2 ცვლადები', '1.3 ციკლები', '1.4 ფუნქციები', '1.5 მასივები']);
    const varChunk = chunks.find((c) => c.heading === '1.2 ცვლადები')!;
    expect(outline[1].chunkPosition).toBe(varChunk.position);
  });
});

describe('retrieval helpers', () => {
  it('tokenizes Georgian, Latin and identifiers', () => {
    expect(tokenize('HTML ტეგები და $scope, ng-model')).toEqual(['html', 'ტეგები', 'და', '$scope', 'ng', 'model']);
  });
  it('cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([], [1])).toBe(0);
  });
});

describe('planner helpers', () => {
  it('parses fenced model JSON and applies defaults', () => {
    const raw = '```json\n{"courseSummary":"s","modules":[{"title":"HTML","summary":"HTML basics","weight":"3"}]}\n```';
    const parsed = parseModelJson(raw, curriculumDraftSchema);
    expect(parsed.modules[0].weight).toBe(3);
    expect(parsed.notesForTeacher).toEqual([]);
  });

  it('pads and trims to the exact lesson count', () => {
    const lesson: LessonBlueprint = {
      kind: 'LEARN', title: 'L', summary: 's', objectives: ['o'], topics: ['t'],
      flow: [{ step: 'a', minutes: 90 }, { step: 'b', minutes: 90 }], realWorldExample: 'r',
      practiceIdeas: [{ type: 'quiz', description: 'q', difficulty: 'easy' }],
      homework: { description: 'h', deliverable: 'd' }, sourceHeadings: [],
    };
    expect(normalizeLessonCount([lesson, lesson, lesson], 2, 'M')).toHaveLength(2);
    const padded = normalizeLessonCount([lesson], 5, 'M');
    expect(padded).toHaveLength(5);
    expect(padded[4].kind).toBe('ASSESSMENT');
    expect(padded[1].kind).toBe('PRACTICE');
  });

  it('join codes use the unambiguous alphabet', () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
  });
});
