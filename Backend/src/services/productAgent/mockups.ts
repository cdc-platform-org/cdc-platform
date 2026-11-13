/**
 * Product agent — store mockup images (cover + gallery) built by compositing.
 * Exports: wallMockup, flatLayMockup, MockupFrame.
 *
 * A handful of empty-room and desk photos are generated once with
 * gpt-image-2 and saved as ProductAgentAsset rows; every later mockup is
 * composited onto one of them with sharp, so a product's 3–5 gallery
 * images cost nothing extra. The library grows to LIBRARY_TARGET per kind
 * over the first runs, then is only reused.
 */
import sharp from 'sharp';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { uploadImage } from '../integrations/imageStorage';
import { generateArtwork, RunCost } from './ai';

const LIBRARY_TARGET = 6;
const OUT_W = 1600;
const OUT_H = 1200; // 4:3 — what the store gallery shows uncropped (see admin COVER_SIZE_HINT)

const ROOM_PROMPTS: Record<string, string[]> = {
  ROOM_LIVING: [
    'living room with a light linen sofa, a wooden side table with a vase of dried flowers, warm beige wall',
    'scandinavian living room with a cream sofa, green cushions, a jute rug and a floor plant, off-white wall',
    'modern minimalist living room with a grey sofa, a round coffee table and a soft wool throw, light greige wall',
  ],
  ROOM_BEDROOM: [
    'calm bedroom with a low wooden bed and white linen bedding, a bedside table with a small lamp, warm white wall',
    'japandi bedroom with a light oak bed frame, beige bedding and a paper lamp, soft sand-coloured wall',
  ],
  DESK: [
    'top-down flat lay photo of a light oak desk, a small plant in one corner, a pen and a cup of coffee near the edges, large empty area in the middle',
    'top-down flat lay photo of a white marble desk surface with a eucalyptus sprig and a pencil at the edges, large empty area in the middle',
  ],
};

async function libraryImage(cost: RunCost, kind: keyof typeof ROOM_PROMPTS): Promise<Buffer> {
  const existing = await prisma.productAgentAsset.findMany({ where: { kind } });
  if (existing.length >= LIBRARY_TARGET || (existing.length > 0 && Math.random() < 0.6)) {
    const pick = existing[Math.floor(Math.random() * existing.length)];
    const res = await fetch(pick.url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  const scene = ROOM_PROMPTS[kind][existing.length % ROOM_PROMPTS[kind].length];
  const prompt = kind === 'DESK'
    ? `Photorealistic ${scene}. Soft natural daylight, gentle shadows, interior-magazine quality. No paper, no documents, no screens, no text.`
    : `Photorealistic interior photograph, straight-on eye-level view: ${scene}. The whole upper half of the picture is a plain, completely empty wall with nothing hanging on it, furniture only in the lower part of the picture. Soft natural daylight from a window on the side, interior-magazine quality. No artwork, no picture frames, no mirrors, no shelves on the wall, no text.`;
  const buffer = await generateArtwork(cost, { prompt, size: '1536x1024', quality: 'medium', guardrails: false });
  const url = await uploadImage({ buffer, mimetype: 'image/png', folderName: 'product-agent-assets', filename: `${kind.toLowerCase()}-${Date.now()}-${crypto.randomUUID()}.png` });
  await prisma.productAgentAsset.create({ data: { kind, url } });
  return buffer;
}

async function toCanvas(bg: Buffer): Promise<Buffer> {
  return sharp(bg).resize(OUT_W, OUT_H, { fit: 'cover', position: 'centre' }).toBuffer();
}

export interface MockupFrame {
  art: Buffer;
  // width / height of the print as hung (e.g. 2/3 for a portrait print).
  ratio: number;
}

const FRAME_COLORS = [
  { frame: '#b48a5f', inner: '#9a7249' }, // oak
  { frame: '#2b2b2b', inner: '#1a1a1a' }, // black
  { frame: '#f3f0ea', inner: '#ddd8cf' }, // white
];

// One framed print: thin moulding, white mat, drop shadow underneath.
async function framed(art: Buffer, w: number, h: number, color: (typeof FRAME_COLORS)[number]): Promise<{ img: Buffer; shadow: Buffer }> {
  const border = Math.max(6, Math.round(Math.min(w, h) * 0.035));
  const mat = Math.round(Math.min(w, h) * 0.06);
  const innerW = w - 2 * (border + mat);
  const innerH = h - 2 * (border + mat);
  const artImg = await sharp(art).resize(innerW, innerH, { fit: 'cover' }).toBuffer();
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${color.frame}"/>
    <rect x="${border - 2}" y="${border - 2}" width="${w - 2 * border + 4}" height="${h - 2 * border + 4}" fill="${color.inner}"/>
    <rect x="${border}" y="${border}" width="${w - 2 * border}" height="${h - 2 * border}" fill="#fbfaf7"/>
  </svg>`;
  const img = await sharp(Buffer.from(svg)).composite([{ input: artImg, left: border + mat, top: border + mat }]).png().toBuffer();
  const pad = 30;
  const shadow = await sharp(Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}" xmlns="http://www.w3.org/2000/svg"><rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="rgba(0,0,0,0.38)"/></svg>`))
    .blur(12)
    .png()
    .toBuffer();
  return { img, shadow };
}

// Prints hung side by side on an empty wall. `heightShare` is the frame
// height as a share of the image height.
export async function wallMockup(cost: RunCost, frames: MockupFrame[], room: 'ROOM_LIVING' | 'ROOM_BEDROOM', heightShare = 0.42): Promise<Buffer> {
  const canvas = await toCanvas(await libraryImage(cost, room));
  const color = FRAME_COLORS[Math.floor(Math.random() * FRAME_COLORS.length)];
  let h = Math.round(OUT_H * heightShare);
  const gap = Math.round(OUT_W * 0.03);
  const widthFor = (fh: number) => frames.reduce((s, f) => s + Math.round(fh * f.ratio), 0) + gap * (frames.length - 1);
  while (widthFor(h) > OUT_W * 0.72) h = Math.round(h * 0.95);
  let x = Math.round((OUT_W - widthFor(h)) / 2);
  const top = Math.round(OUT_H * 0.08);
  const layers: sharp.OverlayOptions[] = [];
  for (const f of frames) {
    const w = Math.round(h * f.ratio);
    const { img, shadow } = await framed(f.art, w, h, color);
    layers.push({ input: shadow, left: x - 30 + 8, top: top - 30 + 14 });
    layers.push({ input: img, left: x, top });
    x += w + gap;
  }
  return sharp(canvas).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

// Document pages laid on a desk, slightly fanned, for planners/worksheets/
// templates. `pages` are page renders (PNG); ratio comes from each image.
export async function flatLayMockup(cost: RunCost, pages: Buffer[]): Promise<Buffer> {
  const canvas = await toCanvas(await libraryImage(cost, 'DESK'));
  const shown = pages.slice(0, 3);
  const angles = shown.length === 1 ? [0] : shown.length === 2 ? [-5, 5] : [-7, 0, 7];
  const maxH = OUT_H * (shown.length === 1 ? 0.8 : 0.66);
  const maxW = OUT_W * (shown.length === 1 ? 0.75 : 0.42);
  const layers: sharp.OverlayOptions[] = [];
  const spread = Math.round(OUT_W * 0.22);
  // Back to front, so the first page (usually the cover) lies on top.
  for (let i = shown.length - 1; i >= 0; i--) {
    const meta = await sharp(shown[i]).metadata();
    // Fit by height for portrait pages, by width for wide ones (business
    // cards), so the rotated page never exceeds the canvas.
    const aspect = (meta.width ?? 210) / (meta.height ?? 297);
    const pageH = Math.round(Math.min(maxH, maxW / aspect));
    const pageW = Math.round(pageH * aspect);
    const paper = await sharp(shown[i]).resize(pageW, pageH, { fit: 'fill' }).flatten({ background: '#ffffff' }).png().toBuffer();
    const pad = 24;
    const withShadow = await sharp({ create: { width: pageW + pad * 2, height: pageH + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: await sharp(Buffer.from(`<svg width="${pageW + pad * 2}" height="${pageH + pad * 2}" xmlns="http://www.w3.org/2000/svg"><rect x="${pad + 4}" y="${pad + 8}" width="${pageW}" height="${pageH}" fill="rgba(0,0,0,0.35)"/></svg>`)).blur(9).png().toBuffer(), left: 0, top: 0 },
        { input: paper, left: pad, top: pad },
      ])
      .png()
      .toBuffer();
    const rotated = await sharp(withShadow).rotate(angles[i], { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const rm = await sharp(rotated).metadata();
    const cx = OUT_W / 2 + (i - (shown.length - 1) / 2) * spread;
    layers.push({ input: rotated, left: Math.max(0, Math.round(cx - (rm.width ?? 0) / 2)), top: Math.max(0, Math.round(OUT_H / 2 - (rm.height ?? 0) / 2)) });
  }
  return sharp(canvas).composite(layers).jpeg({ quality: 90 }).toBuffer();
}
