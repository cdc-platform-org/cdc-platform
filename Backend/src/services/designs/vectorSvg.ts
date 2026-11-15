/** Standalone SVG from validated text/shapes. No raw SVG or raster wrappers.
 * Font bytes are embedded so KA/EN text stays editable and portable.
 */
import fs from 'fs';
import fontkit from '@pdf-lib/fontkit';
import { BOOK_FONTS } from '../childrensBook/bookFonts';
import { DesignTemplate } from '../../schemas/designTemplateSchemas';

const PT_TO_MM = 25.4 / 72;
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const number = (value: number) => String(Math.round(value * 1_000_000) / 1_000_000);
const fontChoices = {
  FiraGO: BOOK_FONTS.MODERN,
  'Noto Sans Georgian': BOOK_FONTS.SIMPLE,
  'Noto Serif Georgian': BOOK_FONTS.FAIRYTALE,
  'Google Sans': BOOK_FONTS.ROUNDED,
  Literata: BOOK_FONTS.FAIRYTALE,
};

const fontCache = new Map<string, { base64: string; font: ReturnType<typeof fontkit.create> }>();
function loadFont(filename: string) {
  let entry = fontCache.get(filename);
  if (!entry) {
    const bytes = fs.readFileSync(filename);
    entry = {base64: bytes.toString('base64'), font: fontkit.create(bytes)};
    fontCache.set(filename, entry);
  }
  return entry;
}

export function isVectorPage(template: DesignTemplate, pageIndex: number): boolean {
  const page = template.pages[pageIndex];
  return !!page && typeof page.background !== 'object' && page.elements.every(el => el.type !== 'image');
}

export function renderVectorSvg(template: DesignTemplate, pageIndex = 0, transparent = false, outlineText = false): string {
  if (!isVectorPage(template, pageIndex)) throw new Error('SVG export requires a page containing only text and vector shapes.');
  const page = template.pages[pageIndex];
  const definitions = new Map<string, string>();
  const background = typeof page.background === 'string' ? page.background : template.page.background;
  const elements: string[] = [];
  if (!transparent) elements.push(`<rect data-page-background="true" width="100%" height="100%" fill="${xml(background)}"/>`);
  for (const el of page.elements) {
    const attrs = `id="${xml(el.id)}" opacity="${el.opacity}" transform="rotate(${number(el.rotation)} ${number(el.xMm + el.wMm / 2)} ${number(el.yMm + el.hMm / 2)})"`;
    if (el.type === 'shape') {
      const paint = `fill="${el.fill ? xml(el.fill) : 'none'}" stroke="${el.stroke ? xml(el.stroke) : 'none'}" stroke-width="${number(el.strokeWidthMm)}"`;
      if (el.shape === 'ellipse') elements.push(`<ellipse ${attrs} ${paint} cx="${number(el.xMm + el.wMm / 2)}" cy="${number(el.yMm + el.hMm / 2)}" rx="${number(el.wMm / 2)}" ry="${number(el.hMm / 2)}"/>`);
      else if (el.shape === 'line') elements.push(`<rect ${attrs} x="${number(el.xMm)}" y="${number(el.yMm)}" width="${number(el.wMm)}" height="${number(el.hMm)}" fill="${xml(el.stroke ?? el.fill ?? '#000000')}"/>`);
      else elements.push(`<rect ${attrs} ${paint} x="${number(el.xMm)}" y="${number(el.yMm)}" width="${number(el.wMm)}" height="${number(el.hMm)}" rx="${number(Math.min(el.radiusMm, el.wMm / 2, el.hMm / 2))}"/>`);
    } else if (el.type === 'text') {
      const choice = fontChoices[el.fontFamily];
      const faces = [...new Set([choice.latin[el.fontWeight === 700 ? 'bold' : 'regular'], choice.georgian[el.fontWeight === 700 ? 'bold' : 'regular']])];
      const loaded = faces.map(filename => {
        const existingIndex = [...definitions.keys()].indexOf(filename);
        const name = `cdc-font-${existingIndex >= 0 ? existingIndex + 1 : definitions.size + 1}`;
        const font = loadFont(filename);
        if (!definitions.has(filename)) definitions.set(filename, `@font-face{font-family:'${name}';font-weight:${el.fontWeight};font-style:normal;src:url(data:font/woff;base64,${font.base64}) format('woff')}`);
        return {name, ...font};
      });
      const width = (text: string, size: number) => [...text].reduce((sum, ch) => {
        const cp = ch.codePointAt(0)!;
        const face = loaded.find(f => f.font.hasGlyphForCodePoint(cp)) ?? loaded[0];
        return sum + face.font.glyphForCodePoint(cp).advanceWidth / face.font.unitsPerEm * size + el.letterSpacing / 1000 * size;
      }, 0);
      // Like the editor's Textbox, text grows down when it wraps. Preserve
      // the chosen font size instead of silently shrinking the download.
      const size = el.fontSizePt * PT_TO_MM;
      const lines = wrap(el.text, text => width(text, size), el.wMm);
      const x = el.align === 'center' ? el.xMm + el.wMm / 2 : el.align === 'right' ? el.xMm + el.wMm : el.xMm;
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      if (outlineText) {
        const paths: string[] = [];
        for (const [i, line] of lines.entries()) {
          let cursor = x - (anchor === 'middle' ? width(line, size) / 2 : anchor === 'end' ? width(line, size) : 0);
          for (const ch of line) {
            const cp = ch.codePointAt(0)!;
            const face = loaded.find(f => f.font.hasGlyphForCodePoint(cp)) ?? loaded[0];
            const glyph = face.font.glyphForCodePoint(cp);
            const scale = size / face.font.unitsPerEm;
            paths.push(`<path d="${xml(glyph.path.toSVG())}" transform="translate(${number(cursor)} ${number(el.yMm + size * 0.9 + i * size * el.lineHeight)}) scale(${number(scale)} ${number(-scale)})"/>`);
            cursor += glyph.advanceWidth * scale + el.letterSpacing / 1000 * size;
          }
        }
        elements.push(`<g ${attrs} fill="${xml(el.color)}">${paths.join('')}</g>`);
        continue;
      }
      const spans = lines.map((line, i) => `<tspan x="${number(x)}" y="${number(el.yMm + size * 0.9 + i * size * el.lineHeight)}">${xml(line)}</tspan>`).join('');
      elements.push(`<text ${attrs} font-family="${loaded.map(f => f.name).join(',')}" font-size="${number(size)}" font-weight="${el.fontWeight}" font-style="${el.italic ? 'italic' : 'normal'}" text-decoration="${el.underline ? 'underline' : 'none'}" letter-spacing="${number(el.letterSpacing / 1000 * size)}" text-anchor="${anchor}" fill="${xml(el.color)}" xml:space="preserve">${spans}</text>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${number(template.page.widthMm)}mm" height="${number(template.page.heightMm)}mm" viewBox="0 0 ${number(template.page.widthMm)} ${number(template.page.heightMm)}"><title>${xml(template.title ?? 'CDC design')}</title><defs><style>${outlineText ? '' : [...definitions.values()].join('\n')}</style></defs>${elements.join('\n')}</svg>`;
}

function wrap(text: string, measure: (value: string) => number, maxWidth: number): string[] {
  return text.split('\n').flatMap(paragraph => {
    const lines: string[] = [];
    let line = '';
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    return [...lines, line];
  });
}
