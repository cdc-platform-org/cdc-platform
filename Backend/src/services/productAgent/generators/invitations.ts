/**
 * Product agent — editable invitations / cards (5 × 7 in, KA + EN).
 * Exports: generateInvitations.
 *
 * One decorative background is generated with a deliberately empty centre;
 * all wording sits on top as editable text, so buyers change names, date
 * and place in the CDC editor.
 */
import { z } from 'zod';
import { writeJson, generateArtwork } from '../ai';
import { composeDescription } from '../listingText';
import { Generator, Layout, LANGS, buildDocumentProduct, hexColor, newTemplate, slug } from './shared';

const words = z.object({
  topLine: z.string().min(2).max(50),
  mainLine: z.string().min(2).max(40),
  middleText: z.string().min(10).max(160),
  dateLine: z.string().min(4).max(50),
  placeLine: z.string().min(4).max(70),
  rsvp: z.string().min(4).max(70),
});

const briefSchema = z.object({
  nameKa: z.string().min(3).max(70),
  nameEn: z.string().min(3).max(70),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  textColor: z.string(),
  backgroundPrompt: z.string().min(40).max(700),
  ka: words,
  en: words,
});

const W = 127;
const H = 178;

export const generateInvitations: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You design printable invitations for CDC Studio (Georgia). Use example wording with placeholder-like but natural sample details (e.g. a sample name, "15 ივნისი, 17:00", "რესტორანი «...», თბილისი"), in Georgian ("ka") and English ("en").
Return JSON {"nameKa","nameEn","introKa","introEn","textColor":"#rrggbb readable on the background","backgroundPrompt","ka":{w},"en":{w}}.
w = {"topLine","mainLine","middleText","dateLine","placeLine","rsvp"}.
backgroundPrompt: English prompt for a portrait invitation background: decorative elements ONLY around the edges/corners, a large plain light empty area in the centre for text, no text, no letters, no frames with writing.
Georgian must be natural and correct.`,
    `Occasion/theme: ${ctx.theme.theme}. Do not repeat these titles: ${ctx.theme.recentTitles.join('; ') || 'none'}.`,
    briefSchema
  );
  const color = hexColor(brief.textColor, '#3d3a35');
  const assets = new Map<string, Buffer>([
    ['bg', await generateArtwork(ctx.cost, { prompt: brief.backgroundPrompt, size: '1024x1536', quality: ctx.quality })],
  ]);
  const specs = LANGS.map((lang) => {
    const w = brief[lang];
    const tpl = newTemplate(lang === 'ka' ? brief.nameKa : brief.nameEn, lang, W, H, ['Noto Serif Georgian', 'FiraGO']);
    const l = new Layout('inv', 'Noto Serif Georgian');
    l.image(0, 0, W, H, 'asset:bg', { id: 'background', fit: 'cover', editable: true });
    l.text(18, 38, W - 36, 9, w.topLine, { id: 'top-line', fontSizePt: 11, align: 'center', color, label: 'Top line' });
    l.text(14, 50, W - 28, 24, w.mainLine, { id: 'main-line', fontSizePt: 26, fontWeight: 700, align: 'center', color, lineHeight: 1.1, label: 'Main line' });
    l.text(20, 78, W - 40, 24, w.middleText, { id: 'middle-text', fontSizePt: 10, align: 'center', color, lineHeight: 1.4 });
    l.text(18, 106, W - 36, 8, w.dateLine, { id: 'date', fontSizePt: 12, fontWeight: 700, align: 'center', color, label: 'Date and time' });
    l.text(18, 116, W - 36, 12, w.placeLine, { id: 'place', fontSizePt: 10, align: 'center', color, label: 'Place' });
    l.text(18, 132, W - 36, 10, w.rsvp, { id: 'rsvp', fontSizePt: 8.5, align: 'center', color, label: 'RSVP' });
    tpl.pages.push({ id: 'front', elements: l.elements });
    return { template: tpl, fileBase: `${slug(brief.nameEn)}-${lang === 'ka' ? 'KA' : 'EN'}-5x7in` };
  });
  const built = await buildDocumentProduct(ctx, specs, assets, { includeJson: true });
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | რედაქტირებადი მოსაწვევი | 5 × 7 დიუმი (12.7 × 17.8 სმ)`,
    titleEn: `CDC Studio — ${brief.nameEn} | Editable Invitation | 5 × 7 in (12.7 × 17.8 cm)`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: ['ზომა — 5 × 7 დიუმი (12.7 × 17.8 სმ), დასაბეჭდად გამზადებული PDF', 'ენა — ქართული და ინგლისური ვერსიები', 'რედაქტირებადი — სახელები, თარიღი, ადგილი და ყველა ტექსტი იცვლება CDC-ის რედაქტორში'],
      use: ['გახსენით შაბლონი CDC-ის რედაქტორში, ჩაწერეთ თქვენი ტექსტი და ჩამოტვირთეთ PDF.', 'დაბეჭდეთ სქელ ქაღალდზე ან გაგზავნეთ ციფრულად (Viber, WhatsApp, Messenger).'],
      license: 'PERSONAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: ['Size — 5 × 7 in (12.7 × 17.8 cm), print-ready PDF', 'Language — Georgian and English editions', 'Editable — names, date, place and all wording change in the CDC editor'],
      use: ['Open the template in the CDC editor, type your text and download the PDF.', 'Print on thick card stock or send it digitally (Viber, WhatsApp, Messenger).'],
      license: 'PERSONAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
  };
};
