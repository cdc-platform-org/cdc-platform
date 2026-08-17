import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { ExamSession, ExamSubmission } from '@prisma/client';

// Same Georgian-script font-embedding approach as invoiceService.ts/
// certificateService.ts (see those files' own comments for why pdf-lib's
// built-in StandardFonts can't render Georgian at all) — duplicated rather
// than shared since candidate reports draw a genuinely different layout
// (a variable-length per-question breakdown, not a fixed line-item table).
const GEORGIAN_FONT_BOLD_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff');
const GEORGIAN_FONT_REGULAR_PATH = require.resolve('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff');

const GEORGIAN_CHAR = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;

interface ScriptRun {
  text: string;
  georgian: boolean;
}

function sanitizeLatinForWinAnsi(text: string): string {
  const normalized = text
    .replace(/[–—]/g, '-')
    .replace(/[''']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/…/g, '...');
  return Array.from(normalized)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) ? ch : '?';
    })
    .join('');
}

function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current = '';
  let currentIsGeorgian: boolean | null = null;
  const flush = (chunk: string, isGeorgian: boolean) => (isGeorgian ? chunk : sanitizeLatinForWinAnsi(chunk));
  for (const ch of text) {
    const isGeorgian = GEORGIAN_CHAR.test(ch);
    if (currentIsGeorgian === null || isGeorgian === currentIsGeorgian) {
      current += ch;
      currentIsGeorgian = isGeorgian;
    } else {
      runs.push({ text: flush(current, currentIsGeorgian), georgian: currentIsGeorgian });
      current = ch;
      currentIsGeorgian = isGeorgian;
    }
  }
  if (current) runs.push({ text: flush(current, currentIsGeorgian ?? false), georgian: currentIsGeorgian ?? false });
  return runs;
}

interface MixedFontPair {
  georgian: PDFFont;
  latin: PDFFont;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; color: ReturnType<typeof rgb>; fonts: MixedFontPair; maxWidth: number; lineHeight: number }
): number {
  // Word-wraps at maxWidth, drawing each line and returning the y position
  // after the last line — used for multi-line question/answer/feedback text
  // where a fixed single-line truncation (invoiceService's drawText) would
  // lose most of the content.
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let y = opts.y;
  const widthOf = (s: string) =>
    splitScriptRuns(s).reduce((sum, r) => sum + (r.georgian ? opts.fonts.georgian : opts.fonts.latin).widthOfTextAtSize(r.text, opts.size), 0);

  const drawLine = (s: string) => {
    let x = opts.x;
    for (const run of splitScriptRuns(s)) {
      const font = run.georgian ? opts.fonts.georgian : opts.fonts.latin;
      page.drawText(run.text, { x, y, size: opts.size, font, color: opts.color });
      x += font.widthOfTextAtSize(run.text, opts.size);
    }
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (widthOf(candidate) > opts.maxWidth && line) {
      drawLine(line);
      y -= opts.lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    drawLine(line);
    y -= opts.lineHeight;
  }
  return y;
}

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

// Candidate proctoring/scoring report — one PDF per ExamSubmission, for the
// business to keep/share outside the dashboard. Not an invoice (nothing was
// paid for this specific document), so it uses its own simple letterhead-
// free layout rather than invoiceService's MERCHANT block.
export async function generateExamReportPdf(params: { session: ExamSession; submission: ExamSubmission }): Promise<Buffer> {
  const { session, submission } = params;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const latinRegular = await doc.embedFont(StandardFonts.Helvetica);
  const georgianBold = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_BOLD_PATH), { subset: true });
  const georgianRegular = await doc.embedFont(fs.readFileSync(GEORGIAN_FONT_REGULAR_PATH), { subset: true });
  const boldFonts: MixedFontPair = { georgian: georgianBold, latin: latinBold };
  const regularFonts: MixedFontPair = { georgian: georgianRegular, latin: latinRegular };

  const navy = rgb(0.06, 0.09, 0.16);
  const slate = rgb(0.42, 0.45, 0.52);
  const emerald = rgb(0.02, 0.45, 0.34);
  const amber = rgb(0.7, 0.45, 0.02);
  const rose = rgb(0.7, 0.1, 0.15);
  const marginX = 50;
  let y = height - 60;

  drawWrappedText(page, 'CDC AI Exam Proctoring — Candidate Report', { x: marginX, y, size: 18, color: navy, fonts: boldFonts, maxWidth: width - marginX * 2, lineHeight: 22 });
  y -= 28;

  y = drawWrappedText(page, session.title, { x: marginX, y, size: 13, color: navy, fonts: boldFonts, maxWidth: width - marginX * 2, lineHeight: 16 });
  y -= 6;
  y = drawWrappedText(page, `Topic: ${session.topic}`, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: width - marginX * 2, lineHeight: 12 });
  y -= 16;

  y = drawWrappedText(page, `Candidate: ${submission.candidateName} (${submission.candidateEmail})`, {
    x: marginX, y, size: 11, color: navy, fonts: boldFonts, maxWidth: width - marginX * 2, lineHeight: 14,
  });
  y = drawWrappedText(page, `Status: ${submission.status} · Started: ${submission.startedAt.toISOString().slice(0, 16).replace('T', ' ')}${submission.completedAt ? ` · Completed: ${submission.completedAt.toISOString().slice(0, 16).replace('T', ' ')}` : ''}`, {
    x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: width - marginX * 2, lineHeight: 12,
  });
  y -= 20;

  page.drawLine({ start: { x: marginX, y: y + 10 }, end: { x: width - marginX, y: y + 10 }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  y -= 10;

  const scoreColor = (score: number | null) => (score == null ? slate : score >= PASS_MARK_COLOR ? emerald : score >= 40 ? amber : rose);
  const PASS_MARK_COLOR = 70;

  const scoreLine = (label: string, value: string, color: ReturnType<typeof rgb>) => {
    page.drawText(label, { x: marginX, y, size: 10, font: latinRegular, color: slate });
    page.drawText(value, { x: marginX + 180, y, size: 11, font: latinBold, color });
    y -= 18;
  };

  scoreLine('Total Score', submission.totalScore != null ? `${submission.totalScore}/100` : 'N/A', scoreColor(submission.totalScore));
  scoreLine('MCQ Score', submission.mcqScore != null ? `${submission.mcqScore}/100` : 'N/A', scoreColor(submission.mcqScore));
  scoreLine('Practical/Code Score', submission.practicalScore != null ? `${submission.practicalScore}/100` : 'N/A', scoreColor(submission.practicalScore));
  y -= 6;
  scoreLine('Integrity Score', submission.integrityScore != null ? `${submission.integrityScore}/100` : 'N/A', scoreColor(submission.integrityScore));
  scoreLine('Tab Switches', String(submission.tabSwitches), slate);
  scoreLine('Copy/Paste Events', String(submission.copyPasteCount), slate);
  if (submission.aiTextScore != null) {
    scoreLine('AI-Written Likelihood (advisory)', `${submission.aiTextScore}/100`, submission.aiTextScore >= 70 ? rose : slate);
  }
  y -= 10;

  page.drawLine({ start: { x: marginX, y: y + 10 }, end: { x: width - marginX, y: y + 10 }, thickness: 1, color: rgb(0.85, 0.86, 0.9) });
  y -= 14;

  y = drawWrappedText(page, 'Question Breakdown', { x: marginX, y, size: 12, color: navy, fonts: boldFonts, maxWidth: width - marginX * 2, lineHeight: 16 });
  y -= 6;

  const grades = (submission.answerGrades as unknown as AnswerGradeEntry[] | null) ?? [];
  for (const grade of grades) {
    if (y < 100) break; // stop before running off the page — full detail also lives in the dashboard
    y = drawWrappedText(page, `[${grade.questionType}] ${grade.question}`, {
      x: marginX, y, size: 9.5, color: navy, fonts: boldFonts, maxWidth: width - marginX * 2, lineHeight: 12,
    });
    const resultText =
      grade.aiScore != null ? `Score: ${grade.aiScore}/100${grade.aiFeedback ? ` — ${grade.aiFeedback}` : ''}` : grade.correct != null ? (grade.correct ? 'Correct' : 'Incorrect') : 'Not graded';
    y = drawWrappedText(page, resultText, { x: marginX, y, size: 9, color: slate, fonts: regularFonts, maxWidth: width - marginX * 2, lineHeight: 12 });
    y -= 8;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
