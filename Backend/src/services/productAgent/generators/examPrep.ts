/**
 * Product agent — exam-prep / study sheets: explained items, a practice
 * quiz and an answer key (A4, Georgian explanations).
 * Exports: generateExamPrep.
 *
 * Text-only (no image cost). AI-written study material can contain factual
 * mistakes, so this category is flagged needsFactCheck and the listing
 * stays PENDING until a person has checked it (see categories.ts).
 */
import { z } from 'zod';
import { writeJson } from '../ai';
import { composeDescription } from '../listingText';
import { Generator, Layout, buildDocumentProduct, hexColor, newTemplate, slug } from './shared';
import { TemplatePage } from '../template/types';

const briefSchema = z.object({
  nameKa: z.string().min(3).max(80),
  nameEn: z.string().min(3).max(80),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  levelKa: z.string().min(2).max(40),
  accent: z.string(),
  items: z.array(z.object({ term: z.string().min(1).max(60), explanation: z.string().min(5).max(220), example: z.string().max(160).optional() })).min(12).max(24),
  quiz: z.array(z.object({ question: z.string().min(5).max(200), options: z.array(z.string().min(1).max(80)).length(4), answerIndex: z.number().int().min(0).max(3) })).min(8).max(12),
});

const W = 210;
const M = 16;
const LETTERS = ['ა', 'ბ', 'გ', 'დ'];

export const generateExamPrep: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You are an experienced teacher in Georgia writing a printable study sheet for CDC Studio.
Accuracy is the top priority: only include facts you are certain of; the answer key must be correct.
Explanations are in Georgian (natural, correct Georgian); terms/examples may be in the subject language (e.g. English words for English learning).
Return JSON {"nameKa","nameEn","introKa","introEn","levelKa","accent":"#rrggbb dark","items":[12-24 {"term","explanation","example"?}],"quiz":[8-12 {"question","options":[4],"answerIndex":0-3}]}.
Keep each explanation under 200 characters.`,
    `Topic: ${ctx.theme.theme}. Do not repeat these titles: ${ctx.theme.recentTitles.join('; ') || 'none'}.`,
    briefSchema
  );
  const accent = hexColor(brief.accent, '#334e68');
  const tpl = newTemplate(brief.nameKa, 'ka', 210, 297, ['Noto Sans Georgian', 'FiraGO']);
  const header = (l: Layout, title: string, sub?: string) => {
    l.rect(0, 0, W, 4, { fill: accent });
    l.text(M, 11, W - 2 * M, 12, title, { fontSizePt: 18, fontWeight: 700, color: accent, label: 'Page title' });
    if (sub) l.text(M, 23, W - 2 * M, 7, sub, { fontSizePt: 9.5, color: '#6b7280' });
    l.line(M, 31, W - 2 * M, 0, accent, 0.4);
  };
  const per = 8;
  for (let p = 0; p * per < brief.items.length; p++) {
    const l = new Layout(`i${p}`, 'Noto Sans Georgian');
    header(l, p === 0 ? brief.nameKa : `${brief.nameKa} (გაგრძელება)`, p === 0 ? `დონე: ${brief.levelKa}` : undefined);
    brief.items.slice(p * per, p * per + per).forEach((it, k) => {
      const y = 36 + k * 31.5;
      l.rect(M, y, W - 2 * M, 28.5, { fill: k % 2 ? '#ffffff' : '#f5f7fa', radiusMm: 2 });
      l.text(M + 4, y + 2.5, W - 2 * M - 8, 7, it.term, { id: `item-${p * per + k}-term`, fontSizePt: 11.5, fontWeight: 700, color: accent });
      l.text(M + 4, y + 9.5, W - 2 * M - 8, 11, it.explanation, { id: `item-${p * per + k}-text`, fontSizePt: 9.5, lineHeight: 1.3 });
      if (it.example) l.text(M + 4, y + 21, W - 2 * M - 8, 6, `მაგ.: ${it.example}`, { id: `item-${p * per + k}-example`, fontSizePt: 8.5, color: '#4b5563' });
    });
    tpl.pages.push({ id: `i${p}`, elements: l.elements });
  }
  const qPer = 6;
  for (let p = 0; p * qPer < brief.quiz.length; p++) {
    const l = new Layout(`q${p}`, 'Noto Sans Georgian');
    header(l, 'სავარჯიშო ტესტი', 'შემოხაზეთ სწორი პასუხი');
    brief.quiz.slice(p * qPer, p * qPer + qPer).forEach((q, k) => {
      const n = p * qPer + k + 1;
      const y = 37 + k * 41;
      l.text(M, y, W - 2 * M, 12, `${n}. ${q.question}`, { id: `q${n}`, fontSizePt: 10.5, fontWeight: 700 });
      q.options.forEach((o, j) => {
        const x = M + 4 + (j % 2) * 88;
        const yy = y + 14 + Math.floor(j / 2) * 11;
        l.rect(x, yy + 0.5, 5, 5, { shape: 'ellipse', stroke: accent, strokeWidthMm: 0.3 });
        l.text(x + 7, yy, 78, 10, `${LETTERS[j]}) ${o}`, { id: `q${n}-o${j}`, fontSizePt: 9.5 });
      });
    });
    tpl.pages.push({ id: `q${p}`, elements: l.elements });
  }
  const key = new Layout('key', 'Noto Sans Georgian');
  header(key, 'პასუხები');
  brief.quiz.forEach((q, i) => {
    key.text(M + (i % 3) * 60, 38 + Math.floor(i / 3) * 10, 58, 8, `${i + 1}. ${LETTERS[q.answerIndex]}) ${q.options[q.answerIndex]}`, { id: `key-${i + 1}`, fontSizePt: 9.5 });
  });
  const keyPage: TemplatePage = { id: 'key', elements: key.elements };
  tpl.pages.push(keyPage);

  const built = await buildDocumentProduct(ctx, [{ template: tpl, fileBase: `${slug(brief.nameEn)}-A4` }], new Map(), { includeJson: true });
  const pages = tpl.pages.length;
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | ${pages} გვერდი, ტესტი და პასუხები | A4 PDF`,
    titleEn: `CDC Studio — ${brief.nameEn} | ${pages} Pages with Quiz & Answer Key | A4 PDF`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: [`გვერდები — ${pages}: ${brief.items.length} ახსნილი საკითხი, ${brief.quiz.length}-კითხვიანი ტესტი და პასუხები`, `დონე — ${brief.levelKa}`, 'ფორმატი — A4 PDF + რედაქტირებადი შაბლონი (მასწავლებლებისთვის მოსახერხებელი)'],
      use: ['ჩამოტვირთეთ PDF და დაბეჭდეთ ან ისწავლეთ ეკრანიდან.', 'ჯერ გაიარეთ ახსნები, მერე შეავსეთ ტესტი და შეამოწმეთ პასუხები ბოლო გვერდზე.'],
      license: 'PERSONAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: [`Pages — ${pages}: ${brief.items.length} explained items, a ${brief.quiz.length}-question quiz and the answer key`, `Level — ${brief.levelKa}`, 'Format — A4 PDF + editable template (handy for teachers)', 'Explanations are in Georgian'],
      use: ['Download the PDF and print it or study on screen.', 'Go through the explanations first, then take the quiz and check the answers on the last page.'],
      license: 'PERSONAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
  };
};
