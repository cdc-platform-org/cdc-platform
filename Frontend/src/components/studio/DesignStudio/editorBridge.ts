/**
 * Same-origin bridge to the two embedded editors served from /public/studio:
 *   photo  -> miniPaint (window.Layers, window.AppConfig)   /studio/photo/
 *   vector -> SVG-Edit  (window.svgEditor.svgCanvas)        /studio/vector/
 * Everything the React shell needs from them (export, cross-mode transfer,
 * context for the AI mentor) goes through here, so the shell never touches
 * editor internals directly. Both editors are MIT-licensed, see their LICENSE.txt.
 */

export type StudioMode = 'photo' | 'vector';

/** Site locales the photo editor (miniPaint) ships natively. */
const PHOTO_NATIVE = ['en', 'de', 'es', 'fr', 'tr'];
/** Site locales covered by our runtime dictionaries (public/studio/photo/i18n). */
const PHOTO_BRIDGED = ['ka', 'uk', 'hy', 'az'];

export function editorUrl(mode: StudioMode, locale: string): string {
  if (mode === 'vector') {
    const lang = ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'].includes(locale) ? locale : 'en';
    return `/studio/vector/index.html?lang=${lang}`;
  }
  // Always pass ?lang so a stale miniPaint "language" cookie cannot override the site.
  if (PHOTO_NATIVE.includes(locale)) return `/studio/photo/index.html?lang=${locale}`;
  if (PHOTO_BRIDGED.includes(locale)) return `/studio/photo/index.html?lang=en&cdcLang=${locale}`;
  return '/studio/photo/index.html?lang=en';
}

type AnyWindow = Window & Record<string, any>;

function win(frame: HTMLIFrameElement | null): AnyWindow | null {
  try {
    return (frame?.contentWindow as AnyWindow) ?? null;
  } catch {
    return null;
  }
}

export function isEditorReady(mode: StudioMode, frame: HTMLIFrameElement | null): boolean {
  const w = win(frame);
  if (!w) return false;
  return mode === 'photo' ? !!(w.Layers && w.AppConfig) : !!(w.svgEditor?.isReady && w.svgEditor?.svgCanvas);
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), type));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

// ---------- photo (miniPaint) ----------

export function photoCanvas(frame: HTMLIFrameElement | null): HTMLCanvasElement | null {
  const w = win(frame);
  if (!w?.Layers) return null;
  const dim = w.Layers.get_dimensions();
  const canvas = document.createElement('canvas');
  canvas.width = dim.width;
  canvas.height = dim.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  w.Layers.convert_layers_to_canvas(ctx);
  return canvas;
}

export async function insertImageIntoPhoto(frame: HTMLIFrameElement | null, src: string, name: string): Promise<void> {
  const w = win(frame);
  if (!w?.Layers) throw new Error('photo editor not ready');
  const img = await loadImage(src);
  await w.Layers.insert({
    name,
    type: 'image',
    data: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    width_original: img.naturalWidth,
    height_original: img.naturalHeight,
  });
}

// ---------- vector (SVG-Edit) ----------

export function vectorSvgString(frame: HTMLIFrameElement | null): string | null {
  const canvas = win(frame)?.svgEditor?.svgCanvas;
  return canvas ? String(canvas.getSvgString()) : null;
}

export async function vectorToPngDataUrl(frame: HTMLIFrameElement | null): Promise<string | null> {
  const svg = vectorSvgString(frame);
  if (!svg) return null;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1080;
    canvas.height = img.naturalHeight || 1080;
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Zooms the vector artboard to fit the view (SVG-Edit loses its scroll position while hidden). */
export function fitVectorArtboard(frame: HTMLIFrameElement | null): void {
  const w = win(frame);
  try {
    w?.svgEditor?.zoomChanged?.(w, 'canvas');
  } catch {
    /* best effort: a failed fit only leaves the old zoom */
  }
}

export function insertImageIntoVector(frame: HTMLIFrameElement | null, dataUrl: string, width: number, height: number): void {
  const c = win(frame)?.svgEditor?.svgCanvas;
  if (!c) throw new Error('vector editor not ready');
  const el = c.addSVGElementsFromJson({
    element: 'image',
    attr: { x: 0, y: 0, width, height, id: c.getNextId(), style: 'pointer-events:inherit', preserveAspectRatio: 'xMidYMid meet' },
  });
  c.setHref(el, dataUrl);
  c.clearSelection();
  c.addToSelection([el]);
  fitVectorArtboard(frame);
}

// ---------- shared ----------

/** Current work as a file, for assignment submission or download. */
export async function exportWork(mode: StudioMode, frame: HTMLIFrameElement | null): Promise<File | null> {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  if (mode === 'vector') {
    const svg = vectorSvgString(frame);
    return svg ? new File([svg], `cdc-vector-${stamp}.svg`, { type: 'image/svg+xml' }) : null;
  }
  const canvas = photoCanvas(frame);
  if (!canvas) return null;
  return new File([await canvasToBlob(canvas)], `cdc-photo-${stamp}.png`, { type: 'image/png' });
}

/** Short context for the AI mentor: active tool and document size. */
export function editorContext(mode: StudioMode, frame: HTMLIFrameElement | null): { activeTool?: string; documentInfo?: string } {
  const w = win(frame);
  if (!w) return {};
  try {
    if (mode === 'photo') {
      const dim = w.Layers?.get_dimensions?.();
      const layers = Array.isArray(w.AppConfig?.layers) ? w.AppConfig.layers.length : undefined;
      return {
        activeTool: w.AppConfig?.TOOL?.name,
        documentInfo: dim ? `${dim.width}x${dim.height}px${layers ? `, ${layers} layers` : ''}` : undefined,
      };
    }
    const c = w.svgEditor?.svgCanvas;
    const res = c?.getResolution?.();
    return {
      activeTool: c?.getMode?.(),
      documentInfo: res ? `${Math.round(res.w)}x${Math.round(res.h)} artboard` : undefined,
    };
  } catch {
    return {};
  }
}
