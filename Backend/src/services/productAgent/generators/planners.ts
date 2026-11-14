/**
 * Product agent — printable planners and trackers (A4, KA + EN editions).
 * Exports: generatePlanners.
 *
 * The AI only picks the theme, colours, page mix and cover wording; every
 * page layout is drawn here in code, so pages are always tidy and the text
 * is real, editable text (no image cost at all).
 */
import { z } from 'zod';
import { writeJson } from '../ai';
import { composeDescription } from '../listingText';
import { themeNotes } from '../themes';
import { Generator, Layout, LANGS, buildDocumentProduct, hexColor, newTemplate, slug } from './shared';
import { TemplatePage } from '../template/types';

const PAGE_TYPES = ['weekly', 'monthly', 'habit', 'budget', 'todo', 'meal', 'reading', 'notes'] as const;
type PageType = (typeof PAGE_TYPES)[number];

const L = {
  ka: {
    weekly: 'კვირის გეგმა', monthly: 'თვის გეგმა', habit: 'ჩვევების ტრეკერი', budget: 'ბიუჯეტის გეგმა', todo: 'დღის საქმეები', meal: 'კვების გეგმა', reading: 'წაკითხული წიგნები', notes: 'ჩანაწერები',
    days: ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'],
    short: ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'],
    month: 'თვე:', week: 'კვირა:', notesLabel: 'შენიშვნები', habitCol: 'ჩვევა', income: 'შემოსავალი', expenses: 'ხარჯები', category: 'კატეგორია', planned: 'დაგეგმილი', actual: 'ფაქტობრივი', total: 'ჯამი',
    priorities: 'მთავარი 3 საქმე', checklist: 'სია', date: 'თარიღი:', breakfast: 'საუზმე', lunch: 'სადილი', dinner: 'ვახშამი', grocery: 'საყიდლების სია', bookTitle: 'წიგნი', author: 'ავტორი', finished: 'დასრულდა', rating: 'შეფასება',
  },
  en: {
    weekly: 'Weekly Planner', monthly: 'Monthly Planner', habit: 'Habit Tracker', budget: 'Budget Planner', todo: 'Daily To-Do', meal: 'Meal Planner', reading: 'Reading Log', notes: 'Notes',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    month: 'Month:', week: 'Week:', notesLabel: 'Notes', habitCol: 'Habit', income: 'Income', expenses: 'Expenses', category: 'Category', planned: 'Planned', actual: 'Actual', total: 'Total',
    priorities: 'Top 3 priorities', checklist: 'Checklist', date: 'Date:', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', grocery: 'Grocery list', bookTitle: 'Book', author: 'Author', finished: 'Finished', rating: 'Rating',
  },
};

const briefSchema = z.object({
  nameKa: z.string().min(3).max(70),
  nameEn: z.string().min(3).max(70),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  coverLineKa: z.string().min(3).max(90),
  coverLineEn: z.string().min(3).max(90),
  accent: z.string(),
  soft: z.string(),
  pages: z.array(z.enum(PAGE_TYPES)).min(4).max(7),
});

const W = 210;
const M = 14; // page margin, mm

function header(l: Layout, title: string, accent: string, soft: string, sub?: string) {
  l.rect(0, 0, W, 6, { fill: accent });
  l.text(M, 13, 120, 12, title, { fontSizePt: 22, fontWeight: 700, color: accent, label: 'Page title' });
  if (sub) l.text(130, 16, W - 130 - M, 8, sub, { fontSizePt: 10, color: '#6b7280', align: 'right' });
  l.line(M, 27, W - 2 * M, 0, soft, 0.6);
}

function linesIn(l: Layout, x: number, y: number, w: number, h: number, step = 7, color = '#d9dce1') {
  for (let yy = y + step; yy < y + h - 1; yy += step) l.line(x, yy, w, 0, color, 0.2);
}

function drawPage(type: PageType, lang: 'ka' | 'en', accent: string, soft: string, idx: number): TemplatePage {
  const t = L[lang];
  const l = new Layout(`p${idx}`);
  if (type === 'weekly') {
    header(l, t.weekly, accent, soft, t.week);
    const colW = (W - 2 * M - 6) / 2;
    const boxH = 58;
    t.days.forEach((d, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      const x = M + col * (colW + 6);
      const y = 32 + row * (boxH + 4);
      l.rect(x, y, colW, boxH, { stroke: soft, strokeWidthMm: 0.4, radiusMm: 2 });
      l.rect(x, y, colW, 8, { fill: soft, radiusMm: 2 });
      l.text(x + 3, y + 1.6, colW - 6, 6, d, { fontSizePt: 10, fontWeight: 700, color: accent });
      linesIn(l, x + 3, y + 8, colW - 6, boxH - 8);
    });
    const x = M + colW + 6;
    const y = 32 + 3 * (boxH + 4);
    l.rect(x, y, colW, boxH, { fill: '#fafafa', stroke: soft, strokeWidthMm: 0.4, radiusMm: 2 });
    l.text(x + 3, y + 2, colW - 6, 6, t.notesLabel, { fontSizePt: 10, fontWeight: 700, color: accent });
    linesIn(l, x + 3, y + 8, colW - 6, boxH - 8);
  } else if (type === 'monthly') {
    header(l, t.monthly, accent, soft, t.month);
    const cw = (W - 2 * M) / 7;
    t.short.forEach((d, i) => {
      l.rect(M + i * cw, 32, cw, 8, { fill: i % 2 ? soft : accent, opacity: i % 2 ? 1 : 0.85 });
      l.text(M + i * cw, 33.5, cw, 6, d, { fontSizePt: 9, fontWeight: 700, align: 'center', color: i % 2 ? accent : '#ffffff' });
    });
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) l.rect(M + c * cw, 40 + r * 34, cw, 34, { stroke: soft, strokeWidthMm: 0.35 });
    l.text(M, 248, 60, 6, t.notesLabel, { fontSizePt: 10, fontWeight: 700, color: accent });
    linesIn(l, M, 252, W - 2 * M, 34);
  } else if (type === 'habit') {
    // Drawn as a grid of lines (not one circle per day) so the page stays
    // well under the editor's 150-elements-per-page limit.
    header(l, t.habit, accent, soft, t.month);
    const nameW = 46;
    const cell = (W - 2 * M - nameW) / 31;
    const rows = 18;
    const top = 40;
    const rowH = 13;
    l.text(M, 33, nameW, 6, t.habitCol, { fontSizePt: 9, fontWeight: 700, color: accent });
    for (let d = 0; d < 31; d++) l.text(M + nameW + d * cell, 33.5, cell, 5, String(d + 1), { fontSizePt: 5.5, align: 'center', color: '#6b7280', editable: false });
    for (let r = 0; r <= rows; r++) l.line(M, top + r * rowH, W - 2 * M, 0, r === 0 ? accent : soft, r === 0 ? 0.5 : 0.3);
    for (let d = 0; d <= 31; d++) l.line(M + nameW + d * cell, top, 0, rows * rowH, soft, 0.25);
  } else if (type === 'budget') {
    header(l, t.budget, accent, soft, t.month);
    const table = (y: number, title: string, rows: number) => {
      l.rect(M, y, W - 2 * M, 9, { fill: accent, radiusMm: 1.5 });
      l.text(M + 3, y + 2, 80, 6, title, { fontSizePt: 10, fontWeight: 700, color: '#ffffff' });
      const cols = [t.category, t.planned, t.actual];
      const cw = [(W - 2 * M) * 0.5, (W - 2 * M) * 0.25, (W - 2 * M) * 0.25];
      let x = M;
      cols.forEach((c, i) => {
        l.text(x + 2, y + 11, cw[i] - 4, 6, c, { fontSizePt: 8.5, fontWeight: 700, color: accent });
        x += cw[i];
      });
      for (let r = 0; r <= rows; r++) l.line(M, y + 18 + r * 8, W - 2 * M, 0, '#d9dce1', 0.25);
      l.text(M + 2, y + 20 + rows * 8, 60, 6, t.total, { fontSizePt: 9, fontWeight: 700, color: accent });
      return y + 28 + rows * 8;
    };
    const next = table(32, t.income, 5);
    table(next + 4, t.expenses, 16);
  } else if (type === 'todo') {
    header(l, t.todo, accent, soft, t.date);
    l.rect(M, 32, W - 2 * M, 40, { fill: soft, radiusMm: 3 });
    l.text(M + 4, 35, 100, 6, t.priorities, { fontSizePt: 11, fontWeight: 700, color: accent });
    for (let i = 0; i < 3; i++) {
      l.text(M + 4, 45 + i * 9, 8, 6, `${i + 1}.`, { fontSizePt: 11, fontWeight: 700, color: accent, editable: false });
      l.line(M + 12, 51 + i * 9, W - 2 * M - 18, 0, '#ffffff', 0.4);
    }
    l.text(M, 78, 100, 6, t.checklist, { fontSizePt: 11, fontWeight: 700, color: accent });
    for (let i = 0; i < 22; i++) {
      const y = 87 + i * 9;
      l.rect(M, y, 5, 5, { stroke: accent, strokeWidthMm: 0.35, radiusMm: 0.8 });
      l.line(M + 8, y + 5, W - 2 * M - 8, 0, '#d9dce1', 0.25);
    }
  } else if (type === 'meal') {
    header(l, t.meal, accent, soft, t.week);
    const labelW = 30;
    const cw = (W - 2 * M - labelW) / 3;
    [t.breakfast, t.lunch, t.dinner].forEach((m, i) => {
      l.rect(M + labelW + i * cw, 32, cw, 8, { fill: soft });
      l.text(M + labelW + i * cw, 33.5, cw, 6, m, { fontSizePt: 9, fontWeight: 700, align: 'center', color: accent });
    });
    t.days.forEach((d, r) => {
      const y = 40 + r * 24;
      l.text(M, y + 9, labelW - 2, 6, d, { fontSizePt: 8.5, fontWeight: 700, color: accent });
      for (let c = 0; c < 3; c++) l.rect(M + labelW + c * cw, y, cw, 24, { stroke: soft, strokeWidthMm: 0.35 });
    });
    l.text(M, 212, 80, 6, t.grocery, { fontSizePt: 11, fontWeight: 700, color: accent });
    for (let c = 0; c < 2; c++) for (let i = 0; i < 8; i++) {
      const x = M + c * ((W - 2 * M) / 2);
      l.rect(x, 221 + i * 8, 4, 4, { stroke: accent, strokeWidthMm: 0.3 });
      l.line(x + 6, 225 + i * 8, (W - 2 * M) / 2 - 10, 0, '#d9dce1', 0.25);
    }
  } else if (type === 'reading') {
    header(l, t.reading, accent, soft);
    const cols = [t.bookTitle, t.author, t.finished, t.rating];
    const cw = [(W - 2 * M) * 0.38, (W - 2 * M) * 0.28, (W - 2 * M) * 0.17, (W - 2 * M) * 0.17];
    let x = M;
    l.rect(M, 32, W - 2 * M, 9, { fill: soft });
    cols.forEach((c, i) => {
      l.text(x + 2, 34, cw[i] - 4, 6, c, { fontSizePt: 9, fontWeight: 700, color: accent });
      x += cw[i];
    });
    for (let r = 0; r < 26; r++) {
      const y = 41 + r * 9;
      l.line(M, y + 9, W - 2 * M, 0, '#d9dce1', 0.25);
    }
  } else {
    header(l, t.notes, accent, soft, t.date);
    linesIn(l, M, 32, W - 2 * M, 252, 8);
  }
  return { id: `p${idx}`, elements: l.elements };
}

function coverPage(name: string, line: string, accent: string, soft: string): TemplatePage {
  const l = new Layout('cover');
  l.rect(0, 0, W, 297, { fill: soft });
  l.rect(-40, 190, 170, 170, { shape: 'ellipse', fill: accent, opacity: 0.18 });
  l.rect(120, -50, 140, 140, { shape: 'ellipse', fill: accent, opacity: 0.12 });
  l.rect(M + 6, 96, W - 2 * M - 12, 0.8, { fill: accent });
  l.text(M + 6, 104, W - 2 * M - 12, 40, name, { id: 'cover-title', fontSizePt: 34, fontWeight: 700, color: accent, lineHeight: 1.15, label: 'Title' });
  l.text(M + 6, 148, W - 2 * M - 12, 20, line, { id: 'cover-subtitle', fontSizePt: 14, color: '#4b5563', label: 'Subtitle' });
  l.text(M + 6, 270, W - 2 * M - 12, 8, 'CDC Studio', { fontSizePt: 10, color: '#6b7280', editable: false });
  return { id: 'cover', elements: l.elements };
}

export const generatePlanners: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You design printable planners for CDC Studio, a Georgian online shop. Choose a cohesive, modern, calm look.
Return JSON {"nameKa","nameEn","introKa","introEn","coverLineKa","coverLineEn","accent":"#rrggbb (dark enough for white text)","soft":"#rrggbb (very light tint of accent)","pages":[4-7 of ${PAGE_TYPES.join('|')}]}.
introKa/En: 2-3 sentences on who it is for and how it helps. Georgian must be natural and correct.`,
    `Theme: ${ctx.theme.theme}. 
${themeNotes(ctx.theme)}`,
    briefSchema
  );
  const accent = hexColor(brief.accent, '#2f5d62');
  const soft = hexColor(brief.soft, '#e8f0ef');
  const pages = [...new Set(brief.pages)] as PageType[];
  const specs = LANGS.map((lang) => {
    const tpl = newTemplate(lang === 'ka' ? brief.nameKa : brief.nameEn, lang, 210, 297);
    tpl.pages.push(coverPage(lang === 'ka' ? brief.nameKa : brief.nameEn, lang === 'ka' ? brief.coverLineKa : brief.coverLineEn, accent, soft));
    pages.forEach((p, i) => tpl.pages.push(drawPage(p, lang, accent, soft, i + 1)));
    return { template: tpl, fileBase: `${slug(brief.nameEn)}-${lang === 'ka' ? 'KA' : 'EN'}-A4` };
  });
  const built = await buildDocumentProduct(ctx, specs, new Map(), { includeJson: true });
  const n = pages.length + 1;
  const pageListKa = pages.map((p) => L.ka[p]).join(', ');
  const pageListEn = pages.map((p) => L.en[p]).join(', ');
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | დასაბეჭდი პლანერი | A4 PDF, ქართული და ინგლისური`,
    titleEn: `CDC Studio — ${brief.nameEn} | Printable Planner | A4 PDF, Georgian & English`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: [`გვერდები — ${n} (გარეკანი, ${pageListKa})`, 'ენა — ორი ცალკე ვერსია: ქართული და ინგლისური', 'ფორმატი — A4 PDF, ერგება US Letter-საც („Fit to page“)', 'რედაქტირებადი შაბლონი — ტექსტი და ფერები შეგიძლიათ შეცვალოთ CDC-ის რედაქტორში'],
      use: ['ჩამოტვირთეთ PDF და დაბეჭდეთ იმდენჯერ, რამდენჯერაც დაგჭირდებათ.', 'ან გახსენით PDF ტაბლეტზე (GoodNotes, Notability) და შეავსეთ ელექტრონულად.'],
      license: 'PERSONAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: [`Pages — ${n} (cover, ${pageListEn})`, 'Language — two separate editions: Georgian and English', 'Format — A4 PDF, also prints on US Letter (“Fit to page”)', 'Editable template — change text and colours in the CDC editor'],
      use: ['Download the PDF and print as many copies as you need.', 'Or open the PDF on a tablet (GoodNotes, Notability) and fill it in digitally.'],
      license: 'PERSONAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
  };
};
