/**
 * AI mentor for the CDC Design Studio (Photo + Vector workspace).
 * Answers "how do I…" questions about raster/vector design work and coaches the
 * student, always in the language the student has selected on the site.
 * Provider fallback (Azure → Gemini) lives in courseTutorService.runTutorChat;
 * the HTTP route is POST /api/ai/design-mentor in routes/ai.ts.
 */
import { runTutorChat, TutorChatTurn } from './courseTutorService';

export const DESIGN_MENTOR_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'] as const;
export type DesignMentorLocale = (typeof DESIGN_MENTOR_LOCALES)[number];

const LANGUAGE_NAMES: Record<DesignMentorLocale, string> = {
  ka: 'Georgian (ქართული)',
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  uk: 'Ukrainian',
  tr: 'Turkish',
  hy: 'Armenian',
  az: 'Azerbaijani',
};

export interface DesignMentorParams {
  locale: DesignMentorLocale;
  mode: 'photo' | 'vector';
  activeTool?: string;
  documentInfo?: string;
  message: string;
  history: TutorChatTurn[];
}

// What each embedded editor really offers (miniPaint 4.14 / SVG-Edit 7.4), so
// the mentor never sends students looking for Photoshop/Illustrator-only features.
const PHOTO_CAPABILITIES = [
  'Left toolbar: Select/move object (V), Rectangle selection, Brush (B), Pencil, Colour picker/eyedropper, Eraser, Magic Eraser (removes similar-colour areas, good for plain backgrounds), Fill bucket, Shapes (H), Image/media, Text (T), Gradient, Clone stamp, Crop, Blur, Sharpen, Desaturate, Bulge/Pinch.',
  'Menus: File (New, Open, Export PNG/JPG/WebP/JSON, Save As, Print), Edit (Undo/Redo, Copy/Paste, Select All, Delete selection), View (Zoom, Fit window, Grid, Guides, Ruler), Image (Canvas size, Trim, Resize, Rotate, Flip, Opacity, Color Corrections for brightness/contrast/hue/saturation/luminosity, Auto adjust colours, Histogram), Layer (New, New from selection, Duplicate, Show/Hide, Rename, Merge down, Flatten, Convert to raster, Composition/blend mode), Effects (Gaussian/Box blur, Sharpen, Denoise, Grayscale, Sepia, Black and White, Vignette, Vibrance, Shadow, Emboss, Oil, Pencil, Mosaic, Tilt shift, Instagram-style filters), Tools (Content Fill, Replace Color, Restore Alpha, Color Zoom).',
  'Right panels: Preview/navigator, Colors, Information, Layer details (x, y, size, opacity, rotation), Layers.',
].join('\n');

const VECTOR_CAPABILITIES = [
  'Left toolbar: Select (V), Zoom, Pan, Pencil (freehand), Line, Path/Pen tool with bezier nodes (edit nodes, add/delete nodes, convert segment type, close path), Rectangle/Square and rounded corners, Ellipse/Circle, Text, Image, Star, Polygon, Shape library, Eyedropper, Connector.',
  'Top bar: undo/redo, delete, duplicate, bring to front/send to back, group/ungroup, align (left/centre/right/top/middle/bottom, relative to selection or page), x/y/width/height, rotation, opacity, blur.',
  'Bottom bar: fill and stroke colours with solid, linear and radial gradients, stroke width, dash style, line ends/markers, colour palette, zoom.',
  'Main menu: new image, open/import SVG or image, Document properties (artboard size), export as PNG/JPEG/BMP/WEBP/PDF, save as SVG, editor preferences. Layers panel on the right: add, rename, reorder, hide, move elements between layers.',
].join('\n');

/** Builds the system prompt; exported for tests. */
export function buildDesignMentorInstruction(params: Omit<DesignMentorParams, 'message' | 'history'>): string {
  const language = LANGUAGE_NAMES[params.locale] ?? 'English';
  const editor = params.mode === 'photo'
    ? 'CDC Photo Studio, a Photoshop-style raster editor.'
    : 'CDC Vector Studio, an Illustrator-style vector editor.';
  const capabilities = params.mode === 'photo' ? PHOTO_CAPABILITIES : VECTOR_CAPABILITIES;

  const context = [
    `Workspace: ${params.mode === 'photo' ? 'Photo (raster)' : 'Vector'} mode.`,
    params.activeTool ? `Tool currently selected: ${params.activeTool}.` : '',
    params.documentInfo ? `Document: ${params.documentInfo}.` : '',
  ].filter(Boolean).join('\n');

  return (
    `You are the CDC Design Mentor, a patient senior graphic designer teaching a student inside ${editor}\n\n` +
    `LANGUAGE RULE: Always reply in ${language}, even if the student writes in another language. ` +
    `Keep menu, tool and shortcut names exactly as the student sees them, and add the common English design term in brackets the first time it appears when that helps.\n\n` +
    `How to teach: give short numbered, click-by-click steps for this editor; name the tool and the keyboard shortcut; ` +
    `explain the design reason briefly (composition, contrast, colour, typography); suggest one next exercise when useful. ` +
    `ONLY describe features listed below. If the student asks for something this editor lacks (for example AI "Select Subject", Pen-tool selections in the photo editor, smart objects, pathfinder), say so plainly and give the closest workflow with these tools, or suggest switching modes with the Photo/Vector switch and the "Send to" button in the top bar.\n\n` +
    `Available in this editor:\n${capabilities}\n\n` +
    `Prefer guiding over doing the student's graded work for them. Keep answers under about 180 words unless asked for more. ` +
    `Stay on graphic design, illustration, photo editing and this workspace; politely steer anything else back.\n\n` +
    context
  );
}

export async function askDesignMentor(params: DesignMentorParams): Promise<string> {
  const instruction = buildDesignMentorInstruction(params);
  return runTutorChat(instruction, params.history, params.message);
}
