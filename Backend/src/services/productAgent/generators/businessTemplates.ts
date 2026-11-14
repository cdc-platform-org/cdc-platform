/**
 * Product agent — small-business template kits: A4 price list / menu, A4
 * promo flyer and a two-sided business card, each in KA and EN.
 * Exports: generateBusinessTemplates.
 *
 * One decorative illustration (no text in it) is generated for the flyer;
 * everything else is drawn here, so every word stays editable in the CDC
 * editor (and the PDFs import into Canva as well).
 */
import { z } from 'zod';
import { writeJson, generateArtwork } from '../ai';
import { composeDescription } from '../listingText';
import { themeNotes } from '../themes';
import { Generator, Layout, LANGS, buildDocumentProduct, hexColor, newTemplate, slug, DocumentFileSpec } from './shared';
import { TemplateFont } from '../template/types';

const langContent = z.object({
  brand: z.string().min(2).max(30),
  tagline: z.string().min(3).max(60),
  listTitle: z.string().min(2).max(40),
  items: z.array(z.object({ name: z.string().min(2).max(40), note: z.string().max(60).optional(), price: z.string().min(1).max(12) })).min(6).max(10),
  flyerHeadline: z.string().min(3).max(40),
  flyerText: z.string().min(20).max(220),
  flyerOffer: z.string().min(3).max(40),
  contact: z.array(z.string().min(3).max(45)).min(2).max(3),
  personName: z.string().min(3).max(35),
  personRole: z.string().min(2).max(35),
});

const briefSchema = z.object({
  nameKa: z.string().min(3).max(70),
  nameEn: z.string().min(3).max(70),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  accent: z.string(),
  soft: z.string(),
  font: z.enum(['FiraGO', 'Noto Sans Georgian', 'Noto Serif Georgian']),
  illustrationPrompt: z.string().min(30).max(600),
  ka: langContent,
  en: langContent,
});

type C = z.infer<typeof langContent>;

function priceList(c: C, accent: string, soft: string, font: TemplateFont) {
  const l = new Layout('list', font);
  l.rect(0, 0, 210, 297, { fill: soft });
  l.rect(14, 14, 182, 269, { fill: '#ffffff', radiusMm: 4 });
  l.text(24, 26, 162, 14, c.brand, { id: 'brand', fontSizePt: 28, fontWeight: 700, color: accent, align: 'center', label: 'Business name' });
  l.text(24, 42, 162, 8, c.tagline, { id: 'tagline', fontSizePt: 11, color: '#6b7280', align: 'center' });
  l.rect(80, 54, 50, 0.8, { fill: accent });
  l.text(24, 60, 162, 10, c.listTitle, { id: 'list-title', fontSizePt: 16, fontWeight: 700, align: 'center' });
  const rowH = Math.min(19, 180 / c.items.length);
  c.items.forEach((it, i) => {
    const y = 78 + i * rowH;
    l.text(28, y, 120, 7, it.name, { id: `item-${i}-name`, fontSizePt: 11.5, fontWeight: 700 });
    if (it.note) l.text(28, y + 6.5, 120, 6, it.note, { id: `item-${i}-note`, fontSizePt: 8.5, color: '#6b7280' });
    l.text(150, y, 32, 7, it.price, { id: `item-${i}-price`, fontSizePt: 12, fontWeight: 700, color: accent, align: 'right' });
    l.line(28, y + rowH - 3, 154, 0, '#e5e7eb', 0.25);
  });
  l.text(24, 266, 162, 8, c.contact.join('  ·  '), { id: 'contact', fontSizePt: 9, color: '#6b7280', align: 'center' });
  return { id: 'list', elements: l.elements };
}

function flyer(c: C, accent: string, font: TemplateFont) {
  const l = new Layout('flyer', font);
  l.image(0, 0, 210, 150, 'asset:illustration', { id: 'flyer-image', fit: 'cover' });
  l.rect(0, 150, 210, 147, { fill: accent });
  l.text(18, 162, 174, 22, c.flyerHeadline, { id: 'headline', fontSizePt: 30, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, label: 'Headline' });
  l.text(18, 190, 174, 30, c.flyerText, { id: 'flyer-text', fontSizePt: 12, color: '#ffffff', lineHeight: 1.45 });
  l.rect(18, 226, 100, 18, { fill: '#ffffff', radiusMm: 9 });
  l.text(20, 230.5, 96, 10, c.flyerOffer, { id: 'offer', fontSizePt: 14, fontWeight: 700, color: accent, align: 'center', label: 'Offer' });
  l.text(18, 258, 174, 10, c.brand, { id: 'flyer-brand', fontSizePt: 16, fontWeight: 700, color: '#ffffff' });
  l.text(18, 270, 174, 8, c.contact.join('  ·  '), { id: 'flyer-contact', fontSizePt: 9.5, color: '#ffffff' });
  return { id: 'flyer', elements: l.elements };
}

function card(c: C, accent: string, soft: string, font: TemplateFont) {
  const front = new Layout('card-front', font);
  front.rect(0, 0, 90, 50, { fill: accent });
  front.text(6, 16, 78, 10, c.brand, { id: 'card-brand', fontSizePt: 16, fontWeight: 700, color: '#ffffff', align: 'center' });
  front.text(6, 28, 78, 6, c.tagline, { id: 'card-tagline', fontSizePt: 7, color: '#ffffff', align: 'center' });
  const back = new Layout('card-back', font);
  back.rect(0, 0, 90, 50, { fill: '#ffffff' });
  back.rect(0, 0, 4, 50, { fill: accent });
  back.text(10, 8, 74, 7, c.personName, { id: 'card-name', fontSizePt: 11, fontWeight: 700, color: accent, label: 'Name' });
  back.text(10, 15.5, 74, 5, c.personRole, { id: 'card-role', fontSizePt: 7.5, color: '#6b7280' });
  back.line(10, 23, 30, 0, soft, 0.5);
  back.text(10, 26, 74, 18, c.contact.join('\n'), { id: 'card-contact', fontSizePt: 7, lineHeight: 1.5 });
  return [{ id: 'front', elements: front.elements }, { id: 'back', elements: back.elements }];
}

export const generateBusinessTemplates: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You design ready-to-use marketing template kits for small businesses in Georgia for CDC Studio.
Invent a FICTIONAL example business that fits the theme (example brand name, example prices in ₾, contacts like "+995 5XX XX XX XX", "@brand.ge"), written once in Georgian ("ka") and once in English ("en").
Return JSON {"nameKa","nameEn","introKa","introEn","accent":"#rrggbb (dark)","soft":"#rrggbb (light tint)","font":"FiraGO|Noto Sans Georgian|Noto Serif Georgian","illustrationPrompt","ka":{c},"en":{c}}.
c = {"brand","tagline","listTitle","items":[6-10 {"name","note"?,"price":"25 ₾"}],"flyerHeadline","flyerText","flyerOffer","contact":[2-3],"personName","personRole"}.
illustrationPrompt: English prompt for a stylish photo or illustration for the top of the flyer matching the business (no text, no logos). Georgian must be natural and correct.`,
    `Theme: ${ctx.theme.theme}. 
${themeNotes(ctx.theme)}`,
    briefSchema
  );
  const accent = hexColor(brief.accent, '#7a3e3e');
  const soft = hexColor(brief.soft, '#f6efe9');
  const assets = new Map<string, Buffer>([
    ['illustration', await generateArtwork(ctx.cost, { prompt: brief.illustrationPrompt, size: '1536x1024', quality: 'medium', qa: 'background' })],
  ]);
  const specs: DocumentFileSpec[] = [];
  for (const lang of LANGS) {
    const c = brief[lang];
    const L = lang === 'ka' ? 'KA' : 'EN';
    const base = slug(brief.nameEn);
    const list = newTemplate(`${c.brand} — ${c.listTitle}`, lang, 210, 297, [brief.font]);
    list.pages.push(priceList(c, accent, soft, brief.font));
    const fl = newTemplate(`${c.brand} — flyer`, lang, 210, 297, [brief.font]);
    fl.pages.push(flyer(c, accent, brief.font));
    const bc = newTemplate(`${c.brand} — business card`, lang, 90, 50, [brief.font]);
    bc.pages.push(...card(c, accent, soft, brief.font));
    specs.push({ template: list, fileBase: `${base}-price-list-${L}-A4` }, { template: fl, fileBase: `${base}-flyer-${L}-A4` }, { template: bc, fileBase: `${base}-business-card-${L}-90x50mm` });
  }
  const built = await buildDocumentProduct(ctx, specs, assets, { includeJson: true });
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | ფასების სია, ფლაერი და სავიზიტო ბარათი | რედაქტირებადი შაბლონი`,
    titleEn: `CDC Studio — ${brief.nameEn} | Price List, Flyer & Business Card | Editable Template`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: ['ნაკრები — ფასების სია/მენიუ (A4), სარეკლამო ფლაერი (A4), სავიზიტო ბარათი (90 × 50 მმ, ორმხრივი)', 'ენა — ქართული და ინგლისური ვერსიები', 'ფორმატი — დასაბეჭდი PDF + რედაქტირებადი შაბლონი CDC-ის რედაქტორისთვის', 'ფასები, სახელი და კონტაქტები ნიმუშია — ჩაწერეთ თქვენი'],
      use: ['გახსენით შაბლონი CDC-ის რედაქტორში, შეცვალეთ ტექსტი და ფერები, ჩამოტვირთეთ PDF.', 'PDF შეგიძლიათ Canva-შიც შემოიტანოთ და იქ დაარედაქტიროთ.', 'დაბეჭდეთ სტამბაში ან გამოიყენეთ ციფრულად სოციალურ ქსელებში.'],
      license: 'COMMERCIAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: ['Kit — price list/menu (A4), promo flyer (A4), business card (90 × 50 mm, two-sided)', 'Language — Georgian and English editions', 'Format — print-ready PDF + editable template for the CDC editor', 'Prices, names and contacts are samples — replace them with yours'],
      use: ['Open the template in the CDC editor, change text and colours, download the PDF.', 'You can also import the PDF into Canva and edit it there.', 'Print at a print shop or use it digitally on social media.'],
      license: 'COMMERCIAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'COMMERCIAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
  };
};
