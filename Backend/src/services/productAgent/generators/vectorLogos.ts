/** Logos are native editable geometry and real text, never raster art in an SVG wrapper. */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import fontkit from '@pdf-lib/fontkit';
import { z } from 'zod';
import { writeJson } from '../ai';
import { composeDescription } from '../listingText';
import { themeNotes } from '../themes';
import { Generator, Layout, LANGS, newTemplate, slug } from './shared';
import { DraftFile } from '../publish';
import { parseTemplateOrThrow } from '../../designs/designService';
import { renderVectorSvg } from '../../designs/vectorSvg';
import type { ShapeElement } from '../template/types';

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const language = z.object({brand: z.string().trim().min(2).max(24).regex(/^[^\r\n]+$/), tagline: z.string().trim().min(2).max(48).regex(/^[^\r\n]+$/)});
export const logoBriefSchema = z.object({
  nameKa: z.string().min(3).max(70), nameEn: z.string().min(3).max(70),
  introKa: z.string().min(40).max(500), introEn: z.string().min(40).max(500),
  primary: color, secondary: color,
  ka: language, en: language,
  // Coordinates live in a 100×100 icon canvas. The schema bounds the design,
  // and only known primitives are accepted — the model cannot supply markup.
  shapes: z.array(z.object({
    shape: z.enum(['rect', 'ellipse', 'line']),
    x: z.number().min(5).max(85), y: z.number().min(5).max(85),
    w: z.number().min(3).max(90), h: z.number().min(3).max(90),
    rotation: z.number().min(-180).max(180), radius: z.number().min(0).max(45),
    fill: z.enum(['primary', 'secondary', 'none']),
    stroke: z.enum(['primary', 'secondary', 'none']),
    strokeWidth: z.number().min(0).max(5),
  }).refine(s => {
    const angle = s.rotation * Math.PI / 180;
    const halfWidth = (Math.abs(Math.cos(angle)) * s.w + Math.abs(Math.sin(angle)) * s.h) / 2 + s.strokeWidth / 2;
    const halfHeight = (Math.abs(Math.sin(angle)) * s.w + Math.abs(Math.cos(angle)) * s.h) / 2 + s.strokeWidth / 2;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    return cx - halfWidth >= 0 && cx + halfWidth <= 100 && cy - halfHeight >= 0 && cy + halfHeight <= 100;
  }, 'Keep rotated shapes and strokes inside the icon canvas')
    .refine(s => s.fill !== 'none' || (s.stroke !== 'none' && s.strokeWidth > 0), 'Each shape must be visible')).min(2).max(12),
});

export type LogoBrief = z.infer<typeof logoBriefSchema>;

// Set the actual editable font size to fit, rather than shrinking only the
// download while leaving the editor's longer sample names overlapping.
const fonts = new Map<number, ReturnType<typeof fontkit.create>>();
function fitLabel(text: string, maxPt: number, widthMm: number, weight: 400 | 700) {
  let font = fonts.get(weight);
  if (!font) {
    font = fontkit.create(fs.readFileSync(require.resolve(`@fontsource/firago/files/firago-latin-${weight}-normal.woff`)));
    fonts.set(weight,font);
  }
  const emWidth = font.layout(text).positions.reduce((sum: number, position: {xAdvance: number}) => sum + position.xAdvance, 0) / font.unitsPerEm;
  return Math.floor(Math.min(maxPt, (widthMm - 2) / Math.max(emWidth,0.01) * 72 / 25.4) * 100) / 100;
}

export function buildLogoTemplate(brief: LogoBrief) {
  const template = newTemplate(brief.nameKa, 'ka', 120, 92);
  for (const lang of LANGS) {
    for (const variant of ['color', 'mono', 'inverse'] as const) {
      const l = new Layout(`logo-${lang}-${variant}`);
      const palette = variant === 'color' ? {primary: brief.primary, secondary: brief.secondary} :
        variant === 'mono' ? {primary: '#1b1e21', secondary: '#1b1e21'} : {primary: '#ffffff', secondary: '#ffffff'};
      brief.shapes.forEach((s, i) => {
        const element: ShapeElement = {
          id: `symbol-${i + 1}`, type: 'shape', shape: s.shape,
          xMm: 40 + s.x * 0.4, yMm: 8 + s.y * 0.4, wMm: s.w * 0.4, hMm: s.h * 0.4,
          rotation: s.rotation, fill: s.fill === 'none' ? null : palette[s.fill],
          stroke: s.stroke === 'none' ? null : palette[s.stroke], strokeWidthMm: s.strokeWidth * 0.4,
          radiusMm: s.radius * 0.4, editable: true, locked: false,
          label: lang === 'ka' ? `სიმბოლოს ნაწილი ${i + 1}` : `Symbol part ${i + 1}`,
        };
        l.elements.push(element);
      });
      const ink = variant === 'inverse' ? '#ffffff' : '#1b1e21';
      l.text(10, 54, 100, 14, brief[lang].brand, {id:'brand-name',fontSizePt:fitLabel(brief[lang].brand,26,100,700),fontWeight:700,color:ink,align:'center',label:lang === 'ka' ? 'ბრენდის სახელი' : 'Brand name'});
      l.text(12, 71, 96, 9, brief[lang].tagline, {id:'tagline',fontSizePt:fitLabel(brief[lang].tagline,10,96,400),color:ink,align:'center',label:lang === 'ka' ? 'სლოგანი' : 'Tagline'});
      template.pages.push({id:`${lang}-${variant}`,background:variant === 'inverse' ? '#1b1e21' : '#ffffff',elements:l.elements});
    }
  }
  return parseTemplateOrThrow(template);
}

export const generateVectorLogos: Generator = async ctx => {
  const brief = await writeJson(ctx.cost,
    `Design an original geometric logo template for a FICTIONAL small business for CDC Studio.
Return JSON {nameKa,nameEn,introKa,introEn,primary:'#rrggbb',secondary:'#rrggbb',ka:{brand,tagline},en:{brand,tagline},shapes:[...]}.
Use 2–12 well-composed native vector primitives for an expressive, memorable symbol (rect, ellipse, line). No images, no SVG markup, no copied brand marks. The brand name is separate editable text. Short natural Georgian and English names (2–24 characters), taglines 2–48 characters. Descriptions 40–500 characters, product names 3–70.
Each shape: {shape,x,y,w,h,rotation,radius,fill:'primary|secondary|none',stroke:'primary|secondary|none',strokeWidth}.
Icon coordinates: 100×100, x,y at least 5; x+w and y+h at most 95; w,h at least 3; rotation -180..180, radius 0..45, strokeWidth 0..5. Keep rotated bounds inside the canvas too. Every shape must have a visible fill or stroke. Avoid overlapping shapes that disappear when all are black. Use strong, contrasting foreground colors suitable for a white background, and make the silhouette work in one color. Do not draw white masking shapes. Do not imitate a known logo or use an existing company name. Compose with careful spacing and optical balance.`,
    `Theme: ${ctx.theme.theme}\n${themeNotes(ctx.theme)}`, logoBriefSchema);
  const template = buildLogoTemplate(brief);
  const base = slug(brief.nameEn);
  const files: DraftFile[] = [];
  const previews: Buffer[] = [];
  for (let index = 0; index < template.pages.length; index++) {
    const page = template.pages[index];
    const svg = renderVectorSvg(template, index, true);
    files.push({buffer:Buffer.from(svg),name:`${base}-${page.id}.svg`,mimetype:'image/svg+xml'});
    // Outlined text is used only for local raster previews; the SVG download
    // retains editable text with embedded fonts. Both use exactly this geometry.
    const outlined = Buffer.from(renderVectorSvg(template, index, true, true));
    const png = await sharp(outlined, {density:300}).resize({width:1800}).png().toBuffer();
    files.push({buffer:png,name:`${base}-${page.id}.png`,mimetype:'image/png'});
    if (index < 3) previews.push(await sharp(Buffer.from(renderVectorSvg(template,index,false,true)), {density:180}).resize({width:1000}).flatten({background:typeof page.background === 'string' ? page.background : '#ffffff'}).png().toBuffer());
  }
  const fontLicense = fs.readFileSync(path.join(path.dirname(require.resolve('@fontsource/firago/package.json')), 'LICENSE'));
  files.push({buffer:fontLicense,name:'FiraGO-OFL.txt',mimetype:'text/plain'});
  files.push({buffer:Buffer.from(`CDC Studio — ${brief.nameEn}\n\nქართული / English\nლოგოს რედაქტირებადი, არაექსკლუზიური შაბლონი. ბრენდის სახელი და სლოგანი ნიმუშია.\nEditable, non-exclusive logo template. Business name and tagline are examples.\n\n6 SVG + 6 PNG: KA/EN, color / black / white. Transparent backgrounds. White variants are visible on dark backgrounds.\nCDC-ის რედაქტორში შეცვალეთ ტექსტი, ფერები, ელემენტების ზომა და მდებარეობა. აირჩიეთ გვერდი და ჩამოტვირთეთ SVG ან PNG.\nIn the CDC editor, change text, colors, size and position. Select a page and export SVG or PNG. Enable Transparent background to remove the page background.\nSVG contains editable text and vector shapes, with embedded FiraGO fonts. Install FiraGO if your vector editor does not support embedded fonts. Font license included.\n`),name:'README-KA-EN.txt',mimetype:'text/plain'});
  return {
    category:ctx.category, titleKa:`CDC Studio — ${brief.nameKa} | რედაქტირებადი ვექტორული ლოგო`,
    titleEn:`CDC Studio — ${brief.nameEn} | Editable Vector Logo`,
    descriptionKa:composeDescription('ka', {intro:brief.introKa,
      receive:['6 SVG და 6 PNG — ქართული/ინგლისური, ფერადი, შავი და თეთრი ვერსიები, გამჭვირვალე ფონით','რედაქტირებადი სახელი, სლოგანი, ფერები და ვექტორული სიმბოლოს ნაწილები','არაექსკლუზიური ლოგოს შაბლონი — ბრენდის სახელი და სლოგანი ნიმუშია'],
      use:['გახსენით CDC-ის რედაქტორში, შეცვალეთ ტექსტი, ფერები და ელემენტები.','აირჩიეთ სასურველი გვერდი, მონიშნეთ გამჭვირვალე ფონი და ჩამოტვირთეთ SVG ან PNG.','SVG გახსენით ვექტორულ რედაქტორში; საჭიროებისას დააყენეთ FiraGO შრიფტი.'],license:'COMMERCIAL_USE'}),
    descriptionEn:composeDescription('en', {intro:brief.introEn,
      receive:['6 SVG and 6 PNG files — Georgian/English, color, black and white variants, transparent backgrounds','Editable brand name, tagline, colors and individual vector symbol parts','Non-exclusive logo template — brand name and tagline are examples'],
      use:['Open in the CDC editor and customize text, colors and elements.','Choose a page, enable Transparent background and download SVG or PNG.','Open SVG in a vector editor; install FiraGO if your editor requires it.'],license:'COMMERCIAL_USE'}),
    priceGel:ctx.priceGel,license:'COMMERCIAL_USE',cover:previews[0],gallery:previews,files,editorTemplate:template,
  };
};
