/**
 * Product agent — Georgian kids' worksheet packs: coloring pages with the
 * word and its first letter, plus letter-tracing pages.
 * Exports: generateWorksheets.
 *
 * Pictures are black-and-white line art from gpt-image-2 (no text in the
 * image — Georgian letters are typeset by our PDF renderer). Line art is
 * generated at "medium" quality regardless of the setting: thick outlines
 * gain nothing from "high" and it costs several times less.
 */
import { z } from 'zod';
import { writeJson, generateArtwork } from '../ai';
import { composeDescription } from '../listingText';
import { themeNotes } from '../themes';
import { Generator, Layout, buildDocumentProduct, newTemplate, slug } from './shared';

const briefSchema = z.object({
  nameKa: z.string().min(3).max(70),
  nameEn: z.string().min(3).max(70),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  ageKa: z.string().min(2).max(30),
  ageEn: z.string().min(2).max(30),
  items: z
    .array(z.object({ wordKa: z.string().min(1).max(20), wordEn: z.string().min(1).max(30), prompt: z.string().min(20).max(500) }))
    .min(5)
    .max(6),
  tracingLetters: z.string().min(1).max(40),
});

const GEORGIAN_LETTER = /[ა-ჺ]/;
const W = 210;
const M = 15;

export const generateWorksheets: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You create printable worksheet packs for Georgian children (ages 3–7) for CDC Studio.
Return JSON {"nameKa","nameEn","introKa","introEn","ageKa","ageEn","items":[5-6 of {"wordKa","wordEn","prompt"}],"tracingLetters":"Georgian letters separated by spaces"}.
- wordKa: one simple, correct Georgian noun a child knows (lowercase Georgian script, e.g. "ზებრა"); its first letter will be shown big, so prefer words whose first letters fit the theme.
- prompt: English prompt for a cute black-and-white coloring-page drawing of that object/animal: thick clean outlines, simple shapes, white background, no shading, no grey fill, no text.
- tracingLetters: 4–8 Georgian letters (the first letters of the words, plus related ones).
Georgian must be natural and correct.`,
    `Theme: ${ctx.theme.theme}. 
${themeNotes(ctx.theme)}`,
    briefSchema
  );

  const assets = new Map<string, Buffer>();
  for (let i = 0; i < brief.items.length; i++) {
    assets.set(
      `color${i}`,
      await generateArtwork(ctx.cost, {
        prompt: `Children's coloring book page: ${brief.items[i].prompt}. Pure black outlines on pure white, thick even line weight, large simple areas to colour, centred, no background clutter.`,
        size: '1024x1536',
        quality: 'medium',
        qa: 'lineart',
      })
    );
  }

  const tpl = newTemplate(brief.nameKa, 'ka', 210, 297, ['Noto Sans Georgian', 'FiraGO']);
  const accent = '#e8743b';

  const cover = new Layout('cover', 'Noto Sans Georgian');
  cover.rect(0, 0, W, 297, { fill: '#fff6ec' });
  cover.rect(M, M, W - 2 * M, 297 - 2 * M, { stroke: accent, strokeWidthMm: 1.2, radiusMm: 8, dashMm: 3 });
  cover.text(M + 10, 40, W - 2 * M - 20, 40, brief.nameKa, { id: 'cover-title', fontSizePt: 34, fontWeight: 700, align: 'center', color: accent, label: 'Title' });
  cover.image(55, 90, 100, 150, 'asset:color0', { fit: 'contain', editable: false });
  cover.text(M + 10, 248, W - 2 * M - 20, 10, brief.ageKa, { fontSizePt: 14, align: 'center', color: '#6b4f3a' });
  cover.text(M + 10, 262, W - 2 * M - 20, 10, 'სახელი: ______________________', { id: 'child-name', fontSizePt: 13, align: 'center', color: '#6b4f3a', label: 'Child name' });
  tpl.pages.push({ id: 'cover', elements: cover.elements });

  brief.items.forEach((item, i) => {
    const l = new Layout(`c${i}`, 'Noto Sans Georgian');
    const first = [...item.wordKa].find((ch) => GEORGIAN_LETTER.test(ch)) ?? item.wordKa[0];
    l.rect(M, 12, 34, 34, { shape: 'ellipse', fill: accent });
    l.text(M, 17.5, 34, 26, first, { fontSizePt: 54, fontWeight: 700, align: 'center', color: '#ffffff', editable: false });
    l.text(M + 40, 20, W - 2 * M - 40, 20, item.wordKa, { id: `word-${i}`, fontSizePt: 36, fontWeight: 700, color: '#2b2b2b', label: 'Word' });
    l.image(M, 54, W - 2 * M, 205, `asset:color${i}`, { fit: 'contain', editable: false });
    l.text(M, 266, W - 2 * M, 8, 'გააფერადე სურათი და სიტყვა გადაწერე ქვემოთ:', { fontSizePt: 11, color: '#6b4f3a' });
    l.line(M, 284, W - 2 * M, 0, '#9ca3af', 0.4, 2);
    tpl.pages.push({ id: `c${i}`, elements: l.elements });
  });

  const letters = brief.tracingLetters.split(/\s+/).filter((s) => GEORGIAN_LETTER.test(s)).map((s) => [...s][0]).slice(0, 12);
  for (let p = 0; p < Math.ceil(letters.length / 6); p++) {
    const l = new Layout(`t${p}`, 'Noto Sans Georgian');
    l.text(M, 12, W - 2 * M, 12, 'შემოხაზე და დაწერე ასოები', { fontSizePt: 20, fontWeight: 700, color: accent });
    letters.slice(p * 6, p * 6 + 6).forEach((letter, r) => {
      const y = 32 + r * 43;
      l.line(M, y + 8, W - 2 * M, 0, '#cbd5e1', 0.3, 1.5);
      l.line(M, y + 30, W - 2 * M, 0, '#64748b', 0.5);
      l.text(M, y + 4, 26, 30, letter, { fontSizePt: 64, fontWeight: 700, color: '#2b2b2b', editable: false });
      for (let k = 0; k < 5; k++) l.text(M + 30 + k * 30, y + 4, 26, 30, letter, { fontSizePt: 64, color: '#d1d5db', editable: false });
    });
    tpl.pages.push({ id: `t${p}`, elements: l.elements });
  }

  const built = await buildDocumentProduct(ctx, [{ template: tpl, fileBase: `${slug(brief.nameEn)}-KA-A4` }], assets, { editable: true });
  const pages = tpl.pages.length;
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | ${pages} დასაბეჭდი ფურცელი | A4 PDF`,
    titleEn: `CDC Studio — ${brief.nameEn} | ${pages} Printable Georgian Worksheets | A4 PDF`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: [`გვერდები — ${pages} (გარეკანი, ${brief.items.length} გასაფერადებელი ფურცელი, ასოების წერის ფურცლები)`, `ასაკი — ${brief.ageKa}`, 'ენა — ქართული', 'ფორმატი — A4 PDF, დასაბეჭდად გამზადებული'],
      use: ['ჩამოტვირთეთ PDF და დაბეჭდეთ სახლში ან სკოლაში — რამდენჯერაც საჭიროა.', 'ფურცლები შეგიძლიათ გამოიყენოთ ტაბლეტზეც, ხატვის აპლიკაციაში.'],
      license: 'PERSONAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: [`Pages — ${pages} (cover, ${brief.items.length} coloring pages, letter-tracing pages)`, `Age — ${brief.ageEn}`, 'Language — Georgian', 'Format — print-ready A4 PDF'],
      use: ['Download the PDF and print at home or school as many times as you need.', 'The pages also work on a tablet in any drawing app.'],
      license: 'PERSONAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
    editorTemplate: built.editorTemplate,
  };
};
