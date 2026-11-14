/**
 * Product agent — wall-art print sets (3 matching artworks).
 * Exports: generatePrints.
 *
 * Mirrors the admin's own floral set: 3 prints, KA/EN title with sizes,
 * print-ready 300 DPI PDFs, a room-mockup cover with all three framed and a
 * per-print room mockup gallery. Portrait sets ship 5 ratios per artwork so
 * they fit almost any ready-made frame; square sets ship one 1:1 file.
 */
import { z } from 'zod';
import { writeJson, generateArtwork } from '../ai';
import { composeDescription } from '../listingText';
import { PORTRAIT_PRINT_SPECS, SQUARE_PRINT_SPECS, printPdfFromArtwork, cmLabel, inchLabel } from '../files';
import { wallMockup } from '../mockups';
import { themeNotes } from '../themes';
import { Generator, slug } from './shared';
import { DraftFile } from '../publish';

const briefSchema = z.object({
  collectionNameKa: z.string().min(3).max(80),
  collectionNameEn: z.string().min(3).max(80),
  introKa: z.string().min(40).max(700),
  introEn: z.string().min(40).max(700),
  orientation: z.enum(['portrait', 'square']),
  room: z.enum(['living', 'bedroom']),
  styleNotes: z.string().min(10).max(600),
  artworks: z.array(z.object({ nameEn: z.string().min(2).max(60), prompt: z.string().min(40).max(1200) })).length(3),
});

const SYSTEM = `You are the art director of CDC Studio, a Georgian online shop selling printable wall art.
You design ONE cohesive set of 3 complementary original artworks that look great framed together.
Rules:
- Same style, medium, palette and level of detail across all 3; different but related subjects.
- Commercially popular, tasteful, decor-friendly. Never reference or imitate a named artist, brand, logo or copyrighted character.
- Each artwork prompt is a detailed image-generation prompt in English: subject, composition (generous margins, nothing important at the edges, since it is cropped to several ratios), medium/texture, palette, lighting, mood.
- Georgian text must be natural, correct Georgian (not a word-by-word translation).
Return JSON: {"collectionNameKa","collectionNameEn","introKa","introEn","orientation":"portrait|square","room":"living|bedroom","styleNotes","artworks":[{"nameEn","prompt"} x3]}.
introKa/introEn: 2-3 sentences describing the set and where it fits in a home, like a shop listing (no prices, no sizes).`;

export const generatePrints: Generator = async (ctx) => {
  const brief = await writeJson(
    ctx.cost,
    SYSTEM,
    `Theme for this set: ${ctx.theme.theme}.
${themeNotes(ctx.theme) || ''}
Our first, best-selling listing is an impasto oil-painting floral set.
Prefer portrait unless the theme suits square.`,
    briefSchema
  );

  const square = brief.orientation === 'square';
  const specs = square ? SQUARE_PRINT_SPECS : PORTRAIT_PRINT_SPECS;
  const arts: Buffer[] = [];
  for (const a of brief.artworks) {
    arts.push(
      await generateArtwork(ctx.cost, {
        prompt: `${a.prompt}\n\nStyle for the whole set: ${brief.styleNotes}\nWall-art print, ${square ? 'square' : 'portrait 2:3'} composition with comfortable margins.`,
        size: square ? '2048x2048' : '2048x3072',
        quality: ctx.quality,
        qa: 'art',
      })
    );
  }

  const files: DraftFile[] = [];
  for (let i = 0; i < arts.length; i++) {
    for (const spec of specs) {
      const base = `${String(i + 1).padStart(2, '0')}-${slug(brief.artworks[i].nameEn)}`;
      files.push({ buffer: await printPdfFromArtwork(arts[i], spec, brief.artworks[i].nameEn), name: `${base}_${spec.ratioId}.pdf`, mimetype: 'application/pdf' });
    }
  }

  const ratio = square ? 1 : 2 / 3;
  const frames = arts.map((art) => ({ art, ratio }));
  const mainRoom = brief.room === 'bedroom' ? 'ROOM_BEDROOM' : 'ROOM_LIVING';
  const otherRoom = mainRoom === 'ROOM_LIVING' ? 'ROOM_BEDROOM' : 'ROOM_LIVING';
  const cover = await wallMockup(ctx.cost, frames, mainRoom);
  const gallery: Buffer[] = [];
  for (let i = 0; i < arts.length; i++) gallery.push(await wallMockup(ctx.cost, [frames[i]], i % 2 ? mainRoom : otherRoom, 0.48));
  gallery.push(await wallMockup(ctx.cost, frames, otherRoom, 0.38));

  const big = specs[0];
  const sizeKa = square ? `${cmLabel(big.widthPx)} × ${cmLabel(big.heightPx)} სმ (${inchLabel(big.widthPx)} × ${inchLabel(big.heightPx)} დიუმი)` : '5 პროპორცია, A5-დან 60 × 90 სმ-მდე';
  const sizeEn = square ? `${cmLabel(big.widthPx)} × ${cmLabel(big.heightPx)} cm (${inchLabel(big.widthPx)} × ${inchLabel(big.heightPx)} inches)` : '5 Ratios, A5 up to 60 × 90 cm';
  const total = files.length;

  const receiveKa = [
    `ნაკრები — 3 ციფრული პრინტი${square ? ', თითოეული ცალკე PDF ფაილად' : ''}`,
    'ფორმატი — მაღალი რეზოლუციის, დასაბეჭდად გამზადებული PDF (300 DPI)',
    ...specs.map((s) => `${square ? 'გამოსახულების ზომა' : `პროპორცია ${s.ratioLabel}`} — ${s.widthPx} × ${s.heightPx} პიქსელი, მაქს. ${cmLabel(s.widthPx)} × ${cmLabel(s.heightPx)} სმ; ერგება: ${s.fitsKa}`),
    ...(square ? [] : [`სულ ${total} PDF — თითოეული ნახატი ყველა პროპორციაში`]),
  ];
  const receiveEn = [
    `Set — 3 digital prints${square ? ', each as a separate PDF file' : ''}`,
    'Format — High-resolution, print-ready PDF (300 DPI)',
    ...specs.map((s) => `${square ? 'Image size' : `Ratio ${s.ratioLabel}`} — ${s.widthPx} × ${s.heightPx} px, up to ${cmLabel(s.widthPx)} × ${cmLabel(s.heightPx)} cm; fits: ${s.fitsEn}`),
    ...(square ? [] : [`${total} PDFs in total — every artwork in every ratio`]),
  ];
  const useKa = [
    'გადახდის დადასტურების შემდეგ გახსენით ჩამოტვირთვის ბმული და შეინახეთ ფაილები.',
    'დაბეჭდეთ სახლში, ადგილობრივ სტამბაში, ფოტოატელიეში ან ონლაინ ბეჭდვის სერვისით.',
    `შეარჩიეთ სქელი ფოტოქაღალდი ან საბეჭდი ტილო. ${square ? 'უფრო მცირე ზომისთვის შეინარჩუნეთ კვადრატული პროპორცია (1:1).' : 'აირჩიეთ ის პროპორცია, რომელიც თქვენს ჩარჩოს ემთხვევა.'}`,
  ];
  const useEn = [
    'After payment confirmation, open the download link and save the files.',
    'Print at home, at a local print shop, photo studio, or using an online printing service.',
    `Choose thick photo paper or printable canvas. ${square ? 'For a smaller size, keep the square proportion (1:1).' : 'Pick the ratio that matches your frame.'}`,
  ];

  return {
    category: ctx.category,
    titleKa: `CDC Studio — ${brief.collectionNameKa} | 3 დასაბეჭდი ${square ? 'PDF' : 'ნახატი'} | ${sizeKa}`,
    titleEn: `CDC Studio — ${brief.collectionNameEn} | ${square ? '3 Printable PDFs' : 'Set of 3 Printable Wall Art'} | ${sizeEn}`,
    descriptionKa: composeDescription('ka', { intro: brief.introKa, receive: receiveKa, use: useKa, license: 'PERSONAL_USE' }),
    descriptionEn: composeDescription('en', { intro: brief.introEn, receive: receiveEn, use: useEn, license: 'PERSONAL_USE' }),
    priceGel: ctx.priceGel,
    license: 'PERSONAL_USE',
    cover,
    gallery,
    files,
  };
};
