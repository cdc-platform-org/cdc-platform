/**
 * Product agent — CV + cover letter templates (A4, KA + EN editions).
 * Exports: generateCvTemplates.
 *
 * The AI writes a fictional sample person and picks the look; layouts
 * (sidebar or header style) are drawn here. The photo is a neutral
 * silhouette placeholder made with sharp — no image-generation cost.
 */
import sharp from 'sharp';
import { z } from 'zod';
import { writeJson } from '../ai';
import { composeDescription } from '../listingText';
import { themeNotes } from '../themes';
import { Generator, Layout, LANGS, buildDocumentProduct, hexColor, newTemplate, slug } from './shared';
import { TemplateFont, TemplatePage } from '../template/types';

const personSchema = z.object({
  name: z.string().min(3).max(40),
  jobTitle: z.string().min(2).max(50),
  summary: z.string().min(40).max(420),
  contacts: z.array(z.string().min(3).max(45)).min(3).max(4),
  experience: z.array(z.object({ role: z.string().max(50), company: z.string().max(50), period: z.string().max(25), bullets: z.array(z.string().max(120)).min(1).max(3) })).min(2).max(3),
  education: z.array(z.object({ degree: z.string().max(70), school: z.string().max(60), period: z.string().max(25) })).min(1).max(2),
  skills: z.array(z.string().max(28)).min(5).max(8),
  languages: z.array(z.string().max(30)).min(2).max(4),
  letter: z.string().min(300).max(1500),
});

const briefSchema = z.object({
  nameKa: z.string().min(3).max(60),
  nameEn: z.string().min(3).max(60),
  introKa: z.string().min(40).max(600),
  introEn: z.string().min(40).max(600),
  layout: z.enum(['sidebar', 'header']),
  font: z.enum(['FiraGO', 'Noto Sans Georgian', 'Noto Serif Georgian']),
  accent: z.string(),
  ka: personSchema,
  en: personSchema,
});

const H = {
  ka: { profile: 'პროფილი', experience: 'სამუშაო გამოცდილება', education: 'განათლება', skills: 'უნარები', languages: 'ენები', contact: 'კონტაქტი', letter: 'სამოტივაციო წერილი' },
  en: { profile: 'Profile', experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages', contact: 'Contact', letter: 'Cover Letter' },
};

type Person = z.infer<typeof personSchema>;

// toUpperCase() turns Georgian into Mtavruli capitals, which the embedded
// fonts don't cover — headings in Georgian stay as written.
const caps = (s: string) => (/[Ⴀ-ჿ]/.test(s) ? s : s.toUpperCase());

async function silhouette(): Promise<Buffer> {
  const svg = `<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="600" fill="#e5e7eb"/><circle cx="300" cy="235" r="115" fill="#c4c8cf"/><ellipse cx="300" cy="560" rx="215" ry="175" fill="#c4c8cf"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function body(l: Layout, p: Person, h: (typeof H)['ka'], x: number, y0: number, w: number, accent: string) {
  let y = y0;
  const section = (title: string) => {
    l.text(x, y, w, 7, caps(title), { fontSizePt: 10.5, fontWeight: 700, color: accent });
    l.line(x, y + 7.5, w, 0, accent, 0.4);
    y += 11;
  };
  section(h.profile);
  l.text(x, y, w, 24, p.summary, { id: 'summary', fontSizePt: 9.5, lineHeight: 1.4, label: 'Profile' });
  y += 28;
  section(h.experience);
  p.experience.forEach((e, i) => {
    l.text(x, y, w * 0.7, 6, `${e.role} · ${e.company}`, { id: `exp-${i}-title`, fontSizePt: 10, fontWeight: 700 });
    l.text(x + w * 0.7, y, w * 0.3, 6, e.period, { id: `exp-${i}-period`, fontSizePt: 8.5, color: '#6b7280', align: 'right' });
    l.text(x, y + 6.5, w, 6 * e.bullets.length + 2, e.bullets.map((b) => `• ${b}`).join('\n'), { id: `exp-${i}-bullets`, fontSizePt: 9, lineHeight: 1.35 });
    y += 10 + 5.5 * e.bullets.length;
  });
  y += 2;
  section(h.education);
  p.education.forEach((e, i) => {
    l.text(x, y, w * 0.7, 6, e.degree, { id: `edu-${i}-degree`, fontSizePt: 10, fontWeight: 700 });
    l.text(x + w * 0.7, y, w * 0.3, 6, e.period, { id: `edu-${i}-period`, fontSizePt: 8.5, color: '#6b7280', align: 'right' });
    l.text(x, y + 6, w, 6, e.school, { id: `edu-${i}-school`, fontSizePt: 9, color: '#4b5563' });
    y += 14;
  });
}

function sideList(l: Layout, title: string, items: string[], x: number, y: number, w: number, color: string, id: string): number {
  l.text(x, y, w, 7, caps(title), { fontSizePt: 10, fontWeight: 700, color });
  l.text(x, y + 9, w, items.length * 6 + 2, items.join('\n'), { id, fontSizePt: 9, lineHeight: 1.5, color });
  return y + 14 + items.length * 6;
}

function cvPage(p: Person, lang: 'ka' | 'en', layout: 'sidebar' | 'header', accent: string, font: TemplateFont): TemplatePage {
  const h = H[lang];
  const l = new Layout('cv', font);
  if (layout === 'sidebar') {
    const sw = 68;
    l.rect(0, 0, sw, 297, { fill: accent });
    l.image(14, 16, 40, 40, 'asset:photo', { id: 'photo', clip: 'circle', placeholder: true });
    l.text(8, 62, sw - 16, 22, p.name, { id: 'name', fontSizePt: 18, fontWeight: 700, color: '#ffffff', align: 'center', lineHeight: 1.15, label: 'Full name' });
    l.text(8, 85, sw - 16, 8, p.jobTitle, { id: 'job-title', fontSizePt: 10, color: '#ffffff', align: 'center', label: 'Job title' });
    let y = 102;
    y = sideList(l, h.contact, p.contacts, 10, y, sw - 20, '#ffffff', 'contacts');
    y = sideList(l, h.skills, p.skills, 10, y, sw - 20, '#ffffff', 'skills');
    sideList(l, h.languages, p.languages, 10, y, sw - 20, '#ffffff', 'languages');
    body(l, p, h, sw + 10, 18, 210 - sw - 22, accent);
  } else {
    l.rect(0, 0, 210, 52, { fill: accent });
    l.image(16, 9, 34, 34, 'asset:photo', { id: 'photo', clip: 'circle', placeholder: true });
    l.text(58, 13, 136, 14, p.name, { id: 'name', fontSizePt: 24, fontWeight: 700, color: '#ffffff', label: 'Full name' });
    l.text(58, 28, 136, 8, p.jobTitle, { id: 'job-title', fontSizePt: 12, color: '#ffffff', label: 'Job title' });
    l.text(58, 38, 136, 8, p.contacts.join('  ·  '), { id: 'contacts', fontSizePt: 8.5, color: '#ffffff' });
    body(l, p, h, 16, 62, 120, accent);
    let y = 62;
    y = sideList(l, h.skills, p.skills, 146, y, 48, accent, 'skills');
    sideList(l, h.languages, p.languages, 146, y, 48, accent, 'languages');
  }
  return { id: 'cv', elements: l.elements };
}

function letterPage(p: Person, lang: 'ka' | 'en', accent: string, font: TemplateFont): TemplatePage {
  const l = new Layout('letter', font);
  l.rect(0, 0, 210, 5, { fill: accent });
  l.text(20, 18, 170, 12, p.name, { id: 'letter-name', fontSizePt: 22, fontWeight: 700, color: accent, label: 'Full name' });
  l.text(20, 31, 170, 7, `${p.jobTitle}  ·  ${p.contacts.slice(0, 2).join('  ·  ')}`, { id: 'letter-contacts', fontSizePt: 9, color: '#6b7280' });
  l.line(20, 41, 170, 0, accent, 0.4);
  l.text(20, 50, 170, 8, H[lang].letter, { fontSizePt: 13, fontWeight: 700 });
  l.text(20, 62, 170, 200, p.letter, { id: 'letter-body', fontSizePt: 10.5, lineHeight: 1.55, label: 'Letter text' });
  return { id: 'letter', elements: l.elements };
}

export const generateCvTemplates: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    `You design professional CV + cover-letter templates for CDC Studio (Georgia). Write a realistic but clearly FICTIONAL sample person (invented name, invented companies, example contacts like "+995 5XX XX XX XX", "name@email.ge"), once in Georgian ("ka") and once in English ("en") — same person, natural language in each.
Return JSON {"nameKa","nameEn","introKa","introEn","layout":"sidebar|header","font":"FiraGO|Noto Sans Georgian|Noto Serif Georgian","accent":"#rrggbb (dark, white text readable on it)","ka":{person},"en":{person}}.
person = {"name","jobTitle","summary","contacts":[3-4],"experience":[2-3 {"role","company","period","bullets":[1-3 short]}],"education":[1-2 {"degree","school","period"}],"skills":[5-8 short],"languages":[2-4],"letter":"cover letter, 3 short paragraphs, 150-220 words"}.
Fill one full A4 page: a 3-sentence summary, 3 experience entries with 2-3 bullets each, 2 education entries, 7-8 skills — but keep each line short. introKa/En: 2-3 sentences describing the template for a shop listing.`,
    `Theme: ${ctx.theme.theme}. 
${themeNotes(ctx.theme)}`,
    briefSchema
  );
  const accent = hexColor(brief.accent, '#1f3a5f');
  const assets = new Map<string, Buffer>([['photo', await silhouette()]]);
  const specs = LANGS.map((lang) => {
    const p = brief[lang];
    const tpl = newTemplate(lang === 'ka' ? brief.nameKa : brief.nameEn, lang, 210, 297, [brief.font]);
    tpl.pages.push(cvPage(p, lang, brief.layout, accent, brief.font));
    tpl.pages.push(letterPage(p, lang, accent, brief.font));
    return { template: tpl, fileBase: `${slug(brief.nameEn)}-${lang === 'ka' ? 'KA' : 'EN'}-A4` };
  });
  const built = await buildDocumentProduct(ctx, specs, assets, { includeJson: true });
  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.nameKa} | CV და სამოტივაციო წერილის შაბლონი | ქართული და ინგლისური`,
    titleEn: `CDC Studio — ${brief.nameEn} | CV & Cover Letter Template | Georgian & English`,
    descriptionKa: composeDescription('ka', {
      intro: brief.introKa,
      receive: ['ნაკრები — CV (1 გვერდი) + სამოტივაციო წერილი', 'ენა — ორი ვერსია: ქართული და ინგლისური', 'ფორმატი — A4 PDF + რედაქტირებადი შაბლონი CDC-ის რედაქტორისთვის', 'ფოტოს ადგილი — ჩასვით თქვენი ფოტო ან წაშალეთ'],
      use: ['გახსენით შაბლონი CDC-ის რედაქტორში, ჩაწერეთ თქვენი მონაცემები და ჩამოტვირთეთ PDF.', 'ნიმუშის ტექსტი გამოგონილია — ჩაანაცვლეთ საკუთარი გამოცდილებით.'],
      license: 'PERSONAL_USE',
    }),
    descriptionEn: composeDescription('en', {
      intro: brief.introEn,
      receive: ['Set — CV (1 page) + cover letter', 'Language — two editions: Georgian and English', 'Format — A4 PDF + editable template for the CDC editor', 'Photo slot — add your photo or remove it'],
      use: ['Open the template in the CDC editor, type in your details and download the PDF.', 'The sample text is fictional — replace it with your own experience.'],
      license: 'PERSONAL_USE',
    }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover: built.cover,
    gallery: built.gallery,
    files: built.files,
  };
};
