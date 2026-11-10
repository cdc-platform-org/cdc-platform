import { PDFDocument, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { ExamQuestion, ExamSession, ExamSubmission } from '@prisma/client';
import { isOptionMap } from '../utils/examShuffle';

// Per-student PDF report for the AI Proctored Exam, downloaded by the
// teacher from the dashboard. Rewritten 2026-11-10 after a classroom test:
// the old one-page report had English-only labels, cut off after ~11
// questions, and showed only "Correct"/"Incorrect" without the answers.
// Now: Georgian or English labels (the teacher picks), every question on as
// many pages as needed, the student's answer and the correct answer as
// text, AI score + feedback for open questions, and a clear summary box.
//
// Fonts: Noto Sans Georgian's Georgian, Latin and Latin-Extended subsets
// (one design, so mixed "HTML-ის" text looks even). Each character is drawn
// with the first of those fonts that has a glyph for it.

export type ReportLang = 'ka' | 'en';

const fontFile = (subset: string, weight: number) =>
  require.resolve(`@fontsource/noto-sans-georgian/files/noto-sans-georgian-${subset}-${weight}-normal.woff`);

export interface AnswerGradeEntry {
  questionId: string;
  questionType: string;
  question: string;
  candidateAnswer: string;
  aiScore: number | null;
  aiFeedback: string | null;
  aiTextScore: number | null;
  correct?: boolean;
}

const LABELS = {
  ka: {
    reportTitle: 'გამოცდის შედეგების ანგარიში',
    student: 'მოსწავლე',
    email: 'ელ. ფოსტა',
    started: 'დაწყება',
    finished: 'დასრულება',
    timeSpent: 'დახარჯული დრო',
    minutes: 'წთ',
    status: 'სტატუსი',
    statusCompleted: 'დასრულებული',
    statusFlagged: 'მონიშნული — დარღვევა ან დროის ამოწურვა',
    statusInProgress: 'ჯერ არ დასრულებულა',
    totalScore: 'საერთო ქულა',
    correctAnswers: 'სწორი პასუხები (ტესტი)',
    openScore: 'ღია კითხვ(ებ)ის AI შეფასება',
    perQuestion: (pts: string) => `ყოველი კითხვა ${pts} ქულაა 100-დან`,
    integrityTitle: 'გამოცდის კეთილსინდისიერება',
    integrityScore: 'კეთილსინდისიერების ქულა',
    tabSwitches: 'ტაბიდან / სრული ეკრანიდან გასვლა',
    copyPaste: 'ტექსტის ჩასმა (Paste)',
    cameraAudio: 'კამერის / მიკროფონის სიგნალები',
    aiWritten: 'AI-ით დაწერის ალბათობა (სავარაუდო)',
    questionsTitle: 'კითხვები და პასუხები',
    mcq: 'ტესტი',
    practical: 'ღია კითხვა',
    code: 'კოდი',
    correct: 'სწორია',
    incorrect: 'არასწორია',
    skipped: 'პასუხი არ არის',
    notGraded: 'არ შეფასებულა',
    studentAnswer: 'მოსწავლის პასუხი',
    correctAnswer: 'სწორი პასუხი',
    explanation: 'ახსნა',
    aiFeedback: 'AI შეფასება',
    score: 'ქულა',
    noAnswer: '(პასუხი არ დაუწერია)',
    footer: 'CDC — AI საგამოცდო სისტემა',
    page: (n: number, total: number) => `გვ. ${n} / ${total}`,
    generated: 'შექმნილია',
  },
  en: {
    reportTitle: 'Exam Results Report',
    student: 'Student',
    email: 'Email',
    started: 'Started',
    finished: 'Finished',
    timeSpent: 'Time spent',
    minutes: 'min',
    status: 'Status',
    statusCompleted: 'Completed',
    statusFlagged: 'Flagged — violations or time limit',
    statusInProgress: 'Not finished yet',
    totalScore: 'Total score',
    correctAnswers: 'Correct answers (multiple choice)',
    openScore: 'Open question AI score',
    perQuestion: (pts: string) => `Each question is worth ${pts} of 100 points`,
    integrityTitle: 'Exam integrity',
    integrityScore: 'Integrity score',
    tabSwitches: 'Left the tab / fullscreen',
    copyPaste: 'Paste events',
    cameraAudio: 'Camera / microphone signals',
    aiWritten: 'AI-written likelihood (estimate)',
    questionsTitle: 'Questions and answers',
    mcq: 'Multiple choice',
    practical: 'Open question',
    code: 'Code',
    correct: 'Correct',
    incorrect: 'Incorrect',
    skipped: 'No answer',
    notGraded: 'Not graded',
    studentAnswer: "Student's answer",
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    aiFeedback: 'AI feedback',
    score: 'Score',
    noAnswer: '(no answer written)',
    footer: 'CDC — AI Exam System',
    page: (n: number, total: number) => `Page ${n} / ${total}`,
    generated: 'Generated',
  },
} as const;

const COLORS = {
  ink: rgb(0.07, 0.09, 0.15),
  body: rgb(0.2, 0.23, 0.3),
  muted: rgb(0.42, 0.45, 0.52),
  line: rgb(0.86, 0.88, 0.92),
  panel: rgb(0.96, 0.97, 0.985),
  brand: rgb(0.03, 0.57, 0.7),
  green: rgb(0.02, 0.5, 0.3),
  greenBg: rgb(0.9, 0.97, 0.93),
  amber: rgb(0.72, 0.44, 0.0),
  amberBg: rgb(1, 0.96, 0.88),
  red: rgb(0.75, 0.12, 0.16),
  redBg: rgb(0.99, 0.92, 0.92),
  white: rgb(1, 1, 1),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 48;
const TOP = PAGE_H - 48;
const BOTTOM = 60;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// Tbilisi time (UTC+4, no DST) — teachers read local time, not UTC.
function formatTbilisi(date: Date): string {
  const d = new Date(date.getTime() + 4 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function scoreColors(score: number | null): { fg: RGB; bg: RGB } {
  if (score == null) return { fg: COLORS.muted, bg: COLORS.panel };
  if (score >= 70) return { fg: COLORS.green, bg: COLORS.greenBg };
  if (score >= 40) return { fg: COLORS.amber, bg: COLORS.amberBg };
  return { fg: COLORS.red, bg: COLORS.redBg };
}

// A font "family" = the same weight in several subsets; text is split into
// runs by which subset has the glyph.
class FontFamily {
  private sets: { font: PDFFont; chars: Set<number> }[];
  constructor(fonts: PDFFont[]) {
    this.sets = fonts.map((font) => ({ font, chars: new Set(font.getCharacterSet()) }));
  }
  private fontFor(cp: number): PDFFont | null {
    for (const s of this.sets) if (s.chars.has(cp)) return s.font;
    return null;
  }
  runs(text: string): { text: string; font: PDFFont }[] {
    const out: { text: string; font: PDFFont }[] = [];
    for (const ch of normalizeForPdf(text)) {
      const cp = ch.codePointAt(0) ?? 63;
      let font = this.fontFor(cp);
      let drawn = ch;
      if (!font) {
        drawn = '?';
        font = this.fontFor(63) ?? this.sets[0].font;
      }
      const last = out[out.length - 1];
      if (last && last.font === font) last.text += drawn;
      else out.push({ text: drawn, font });
    }
    return out;
  }
  width(text: string, size: number): number {
    return this.runs(text).reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0);
  }
  draw(page: PDFPage, text: string, x: number, y: number, size: number, color: RGB) {
    for (const r of this.runs(text)) {
      page.drawText(r.text, { x, y, size, font: r.font, color });
      x += r.font.widthOfTextAtSize(r.text, size);
    }
  }
}

function normalizeForPdf(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[​-‍﻿]/g, '');
}

// Word-wraps text (keeping explicit line breaks) to maxWidth. Words longer
// than a line (code, URLs) are broken by character.
function wrap(family: FontFamily, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of normalizeForPdf(text).split('\n')) {
    const words = paragraph.split(/ +/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (let word of words) {
      while (family.width(word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && family.width(word.slice(0, cut), size) > maxWidth) cut--;
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (line && family.width(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  // Drop trailing empty lines from trailing newlines.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

interface ReportQuestion {
  number: number;
  type: 'MCQ' | 'PRACTICAL' | 'CODE';
  question: string;
  options: Record<'A' | 'B' | 'C' | 'D', string> | null;
  chosen: string | null; // MCQ letter (canonical) or open answer text
  correctLetter: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  aiScore: number | null;
  aiFeedback: string | null;
}

function buildReportQuestions(submission: ExamSubmission, questions: ExamQuestion[]): ReportQuestion[] {
  const answers = (submission.answers ?? {}) as Record<string, string>;
  const grades = Array.isArray(submission.answerGrades) ? (submission.answerGrades as unknown as AnswerGradeEntry[]) : [];
  const gradeById = new Map(grades.map((g) => [g.questionId, g]));
  const sorted = [...questions].sort((a, b) => a.order - b.order);
  // Exam deleted questions / legacy data: fall back to the stored grades.
  if (sorted.length === 0) {
    return grades.map((g, i) => ({
      number: i + 1,
      type: (g.questionType as ReportQuestion['type']) ?? 'MCQ',
      question: g.question,
      options: null,
      chosen: g.candidateAnswer || null,
      correctLetter: null,
      isCorrect: g.correct ?? null,
      explanation: null,
      aiScore: g.aiScore,
      aiFeedback: g.aiFeedback,
    }));
  }
  return sorted.map((q, i) => {
    const type = q.type as ReportQuestion['type'];
    const answer = answers[q.id] ?? '';
    if (type === 'MCQ') {
      return {
        number: i + 1,
        type,
        question: q.question,
        options: isOptionMap(q.options) ? q.options : null,
        chosen: answer || null,
        correctLetter: q.correctAnswer ?? null,
        isCorrect: answer ? answer === q.correctAnswer : false,
        explanation: q.explanation ?? null,
        aiScore: null,
        aiFeedback: null,
      };
    }
    const grade = gradeById.get(q.id);
    return {
      number: i + 1,
      type,
      question: q.question,
      options: null,
      chosen: answer.trim() ? answer : null,
      correctLetter: null,
      isCorrect: null,
      explanation: null,
      aiScore: grade?.aiScore ?? null,
      aiFeedback: grade?.aiFeedback ?? null,
    };
  });
}

export async function generateExamReportPdf(params: {
  session: ExamSession;
  submission: ExamSubmission;
  questions?: ExamQuestion[];
  lang?: ReportLang;
}): Promise<Buffer> {
  const { session, submission } = params;
  const L = LABELS[params.lang === 'en' ? 'en' : 'ka'];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${L.reportTitle} — ${submission.candidateName}`);
  doc.setCreator('CDC');

  const embedFamily = async (weight: number) =>
    new FontFamily(
      await Promise.all(
        ['georgian', 'latin', 'latin-ext'].map((subset) => doc.embedFont(fs.readFileSync(fontFile(subset, weight)), { subset: true }))
      )
    );
  const regular = await embedFamily(400);
  const semibold = await embedFamily(600);
  const bold = await embedFamily(700);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = TOP;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = TOP;
  };
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) newPage();
  };
  // Draws wrapped text at x; returns nothing, advances y. Breaks across
  // pages line by line if needed.
  const text = (s: string, opts: { family?: FontFamily; size?: number; color?: RGB; x?: number; width?: number; lineGap?: number }) => {
    const family = opts.family ?? regular;
    const size = opts.size ?? 10;
    const x = opts.x ?? MARGIN_X;
    const width = opts.width ?? CONTENT_W - (x - MARGIN_X);
    const lh = size * 1.45 + (opts.lineGap ?? 0);
    for (const line of wrap(family, s, size, width)) {
      ensure(lh);
      y -= lh;
      family.draw(page, line, x, y + size * 0.3, size, opts.color ?? COLORS.body);
    }
  };
  const textHeight = (s: string, family: FontFamily, size: number, width: number) => wrap(family, s, size, width).length * size * 1.45;

  newPage();

  // ---- Header ----
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: COLORS.brand });
  y -= 4;
  text('CDC', { family: bold, size: 9, color: COLORS.brand });
  text(L.reportTitle, { family: bold, size: 20, color: COLORS.ink });
  y -= 2;
  text(session.title, { family: semibold, size: 13, color: COLORS.body });
  if (session.topic && session.topic.trim() && session.topic.trim() !== session.title.trim()) {
    text(session.topic, { size: 9.5, color: COLORS.muted });
  }
  y -= 14;

  // ---- Student panel ----
  const statusText =
    submission.status === 'FLAGGED' ? L.statusFlagged : submission.status === 'IN_PROGRESS' ? L.statusInProgress : L.statusCompleted;
  const spentMin =
    submission.completedAt != null ? Math.max(1, Math.round((submission.completedAt.getTime() - submission.startedAt.getTime()) / 60000)) : null;
  const infoRows: [string, string][] = [
    [L.student, submission.candidateName],
    [L.email, submission.candidateEmail],
    [L.started, formatTbilisi(submission.startedAt)],
    ...(submission.completedAt ? ([[L.finished, formatTbilisi(submission.completedAt)]] as [string, string][]) : []),
    ...(spentMin != null ? ([[L.timeSpent, `${spentMin} ${L.minutes}`]] as [string, string][]) : []),
    [L.status, statusText],
  ];
  const labelW = 120;
  const rowH = 16;
  const panelH = infoRows.length * rowH + 16;
  ensure(panelH);
  page.drawRectangle({ x: MARGIN_X, y: y - panelH, width: CONTENT_W, height: panelH, color: COLORS.panel, borderColor: COLORS.line, borderWidth: 0.8 });
  let ry = y - 8;
  for (const [label, value] of infoRows) {
    ry -= rowH;
    regular.draw(page, label, MARGIN_X + 14, ry + 4, 9.5, COLORS.muted);
    const color = label === L.status && submission.status === 'FLAGGED' ? COLORS.red : COLORS.ink;
    const shown = wrap(semibold, value, 10, CONTENT_W - labelW - 28)[0] ?? '';
    semibold.draw(page, shown, MARGIN_X + 14 + labelW, ry + 4, 10, color);
  }
  y -= panelH + 18;

  // ---- Score summary ----
  const reportQuestions = buildReportQuestions(submission, params.questions ?? []);
  const mcq = reportQuestions.filter((q) => q.type === 'MCQ');
  const open = reportQuestions.filter((q) => q.type !== 'MCQ');
  const mcqCorrect = mcq.filter((q) => q.isCorrect).length;
  const total = submission.totalScore;
  const tc = scoreColors(total);
  const boxH = 86;
  ensure(boxH);
  const bigW = 150;
  page.drawRectangle({ x: MARGIN_X, y: y - boxH, width: bigW, height: boxH, color: tc.bg });
  regular.draw(page, L.totalScore, MARGIN_X + 14, y - 22, 9.5, tc.fg);
  const totalText = total != null ? `${total}%` : '—';
  bold.draw(page, totalText, MARGIN_X + 14, y - 62, 32, tc.fg);

  const sx = MARGIN_X + bigW + 18;
  let sy = y - 20;
  const stat = (label: string, value: string, color: RGB) => {
    regular.draw(page, label, sx, sy, 9.5, COLORS.muted);
    bold.draw(page, value, sx + 200, sy, 11, color);
    sy -= 20;
  };
  if (mcq.length > 0) {
    const pct = Math.round((mcqCorrect / mcq.length) * 100);
    stat(L.correctAnswers, `${mcqCorrect} / ${mcq.length}`, scoreColors(pct).fg);
  }
  if (open.length > 0) {
    stat(L.openScore, submission.practicalScore != null ? `${submission.practicalScore}/100` : L.notGraded, scoreColors(submission.practicalScore).fg);
  }
  const questionCount = reportQuestions.length;
  if (questionCount > 0) {
    const pts = Math.round((100 / questionCount) * 100) / 100;
    regular.draw(page, L.perQuestion(String(pts)), sx, sy, 9, COLORS.muted);
  }
  y -= boxH + 22;

  // ---- Integrity ----
  ensure(110);
  text(L.integrityTitle, { family: bold, size: 12, color: COLORS.ink });
  y -= 4;
  const integrityRows: [string, string, RGB][] = [
    [L.integrityScore, submission.integrityScore != null ? `${submission.integrityScore}/100` : '—', scoreColors(submission.integrityScore).fg],
    [L.tabSwitches, String(submission.tabSwitches), submission.tabSwitches > 0 ? COLORS.amber : COLORS.body],
    [L.copyPaste, String(submission.copyPasteCount), submission.copyPasteCount > 0 ? COLORS.amber : COLORS.body],
    [L.cameraAudio, String(submission.cameraAudioViolations ?? 0), COLORS.body],
  ];
  if (submission.aiTextScore != null) {
    integrityRows.push([L.aiWritten, `${submission.aiTextScore}%`, submission.aiTextScore >= 70 ? COLORS.red : COLORS.body]);
  }
  for (const [label, value, color] of integrityRows) {
    ensure(18);
    y -= 17;
    regular.draw(page, label, MARGIN_X, y + 4, 9.5, COLORS.muted);
    semibold.draw(page, value, MARGIN_X + 260, y + 4, 10, color);
    page.drawLine({ start: { x: MARGIN_X, y: y - 1 }, end: { x: MARGIN_X + CONTENT_W, y: y - 1 }, thickness: 0.5, color: COLORS.line });
  }
  y -= 22;

  // ---- Questions ----
  ensure(60);
  text(L.questionsTitle, { family: bold, size: 12, color: COLORS.ink });
  y -= 6;

  const indent = MARGIN_X + 12;
  const innerW = CONTENT_W - 12;
  for (const q of reportQuestions) {
    // Keep the question title + status together with at least the first
    // answer line.
    const titleText = `${q.number}. ${q.question}`;
    const titleH = textHeight(titleText, semibold, 10.5, CONTENT_W - 110);
    ensure(titleH + 40);
    y -= 6;
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + CONTENT_W, y }, thickness: 0.6, color: COLORS.line });

    // Status pill (right side)
    let pill: { label: string; fg: RGB; bg: RGB };
    if (q.type === 'MCQ') {
      pill = !q.chosen
        ? { label: L.skipped, fg: COLORS.muted, bg: COLORS.panel }
        : q.isCorrect
          ? { label: L.correct, fg: COLORS.green, bg: COLORS.greenBg }
          : { label: L.incorrect, fg: COLORS.red, bg: COLORS.redBg };
    } else {
      const c = scoreColors(q.aiScore);
      pill = { label: q.aiScore != null ? `${L.score}: ${q.aiScore}/100` : L.notGraded, fg: c.fg, bg: c.bg };
    }
    const pillW = semibold.width(pill.label, 8.5) + 14;
    page.drawRectangle({ x: MARGIN_X + CONTENT_W - pillW, y: y - 20, width: pillW, height: 15, color: pill.bg });
    semibold.draw(page, pill.label, MARGIN_X + CONTENT_W - pillW + 7, y - 15.5, 8.5, pill.fg);

    const typeLabel = q.type === 'MCQ' ? L.mcq : q.type === 'CODE' ? L.code : L.practical;
    y -= 2;
    text(typeLabel, { family: semibold, size: 7.5, color: COLORS.brand });
    text(titleText, { family: semibold, size: 10.5, color: COLORS.ink, width: CONTENT_W - 110 });
    y -= 2;

    if (q.type === 'MCQ') {
      const optText = (letter: string | null) => (letter && q.options ? `${letter}. ${q.options[letter as 'A' | 'B' | 'C' | 'D'] ?? ''}` : letter ?? '—');
      text(`${L.studentAnswer}: ${q.chosen ? optText(q.chosen) : L.skipped}`, {
        x: indent,
        width: innerW,
        size: 9.5,
        color: q.isCorrect ? COLORS.green : q.chosen ? COLORS.red : COLORS.muted,
      });
      if (!q.isCorrect && q.correctLetter) {
        text(`${L.correctAnswer}: ${optText(q.correctLetter)}`, { x: indent, width: innerW, size: 9.5, color: COLORS.green });
      }
      if (!q.isCorrect && q.explanation) {
        text(`${L.explanation}: ${q.explanation}`, { x: indent, width: innerW, size: 9, color: COLORS.muted });
      }
    } else {
      text(`${L.studentAnswer}:`, { x: indent, width: innerW, size: 9, family: semibold, color: COLORS.muted });
      text(q.chosen ?? L.noAnswer, { x: indent + 8, width: innerW - 8, size: 9.5, color: COLORS.body });
      if (q.aiFeedback) {
        y -= 2;
        text(`${L.aiFeedback}: ${q.aiFeedback}`, { x: indent, width: innerW, size: 9, color: COLORS.muted });
      }
    }
    y -= 6;
  }

  // ---- Footer on every page ----
  const generatedAt = formatTbilisi(new Date());
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN_X, y: 40 }, end: { x: PAGE_W - MARGIN_X, y: 40 }, thickness: 0.5, color: COLORS.line });
    regular.draw(p, `${L.footer} · ${L.generated}: ${generatedAt}`, MARGIN_X, 28, 8, COLORS.muted);
    const label = L.page(i + 1, pages.length);
    regular.draw(p, label, PAGE_W - MARGIN_X - regular.width(label, 8), 28, 8, COLORS.muted);
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
