// ============================================================
// Template element <-> Fabric.js object conversion.
//
// The design document (types/designTemplate.ts, millimetres) is the source of
// truth; Fabric objects are a disposable view of one page at a given scale
// (`pxPerMm`). The same builders draw the on-screen editor and the high-DPI
// export (exportDesign.ts), so what the buyer sees is what they download.
//
// Fabric 7 objects default to a CENTRE origin, which matches the template's
// "rotate around the box centre" rule: left/top = box centre in px.
// ============================================================
import { Ellipse, FabricImage, FabricObject, Rect, Circle, Textbox, StaticCanvas } from 'fabric';
import type {
  DesignElement, DesignPage, DesignTemplate, ImageElement, ShapeElement, TextElement,
} from '../../types/designTemplate';
import { fontStack } from './fonts';

export const PT_TO_MM = 25.4 / 72;
const ELEMENT_ID = Symbol('cdcElementId');

type Tagged = FabricObject & { [ELEMENT_ID]?: string };
export function elementIdOf(object: FabricObject): string | undefined {
  return (object as Tagged)[ELEMENT_ID];
}
function tag<T extends FabricObject>(object: T, id: string): T {
  (object as Tagged)[ELEMENT_ID] = id;
  return object;
}

export type ImageCache = Map<string, HTMLImageElement>;

function commonProps(element: DesignElement, pxPerMm: number, interactive: boolean) {
  const locked = !interactive || element.locked || element.editable === false;
  return {
    left: (element.xMm + element.wMm / 2) * pxPerMm,
    top: (element.yMm + element.hMm / 2) * pxPerMm,
    angle: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
    // Non-editable decoration can't even be selected, so a click goes
    // through to whatever the buyer is actually trying to edit.
    selectable: interactive && element.editable !== false,
    evented: interactive && element.editable !== false,
    lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked,
    hasControls: !locked,
  };
}

function buildText(element: TextElement, pxPerMm: number, interactive: boolean): Textbox {
  const box = new Textbox(element.text, {
    ...commonProps(element, pxPerMm, interactive),
    width: element.wMm * pxPerMm,
    fontFamily: fontStack(element.fontFamily),
    fontSize: element.fontSizePt * PT_TO_MM * pxPerMm,
    fontWeight: element.fontWeight ?? 400,
    fontStyle: element.italic ? 'italic' : 'normal',
    underline: !!element.underline,
    fill: element.color,
    // Fabric's 'justify' also stretches the last line of a paragraph;
    // 'justify-left' is what people expect from a word processor.
    textAlign: element.align === 'justify' ? 'justify-left' : element.align ?? 'left',
    lineHeight: element.lineHeight ?? 1.2,
    charSpacing: element.letterSpacing ?? 0,
    // Wrap Georgian/long words inside the box instead of overflowing it.
    splitByGrapheme: false,
  });
  // A Textbox's height follows its content; keep the box's TOP edge where the
  // template put it (text grows downwards), not its centre. readBack()
  // stores the measured height, so the two stay consistent.
  box.top = (element.yMm * pxPerMm) + box.height / 2;
  box.setControlsVisibility({ mt: false, mb: false });
  return box;
}

function buildImage(element: ImageElement, pxPerMm: number, interactive: boolean, images: ImageCache): FabricObject {
  const source = images.get(element.src);
  const boxW = element.wMm * pxPerMm;
  const boxH = element.hMm * pxPerMm;
  if (!source || !source.naturalWidth) {
    // Missing/failed image: a grey placeholder of the same size, still selectable.
    return new Rect({ ...commonProps(element, pxPerMm, interactive), width: boxW, height: boxH, fill: '#e2e8f0', stroke: '#94a3b8', strokeDashArray: [6, 4], strokeUniform: true });
  }
  const iw = source.naturalWidth;
  const ih = source.naturalHeight;
  const image = new FabricImage(source, commonProps(element, pxPerMm, interactive));
  if ((element.fit ?? 'cover') === 'cover') {
    // Crop the source to the box's aspect ratio, centred (CSS object-fit: cover).
    const scale = Math.max(boxW / iw, boxH / ih);
    const cropW = boxW / scale;
    const cropH = boxH / scale;
    image.set({ cropX: (iw - cropW) / 2, cropY: (ih - cropH) / 2, width: cropW, height: cropH, scaleX: scale, scaleY: scale });
  } else {
    const scale = Math.min(boxW / iw, boxH / ih);
    image.set({ scaleX: scale, scaleY: scale });
  }
  if (element.clip === 'circle') {
    image.clipPath = new Circle({ radius: Math.min(image.width, image.height) / 2 });
  }
  // Photos keep their proportions when resized (side handles would stretch them).
  image.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
  return image;
}

function buildShape(element: ShapeElement, pxPerMm: number, interactive: boolean): FabricObject {
  const props = commonProps(element, pxPerMm, interactive);
  const w = element.wMm * pxPerMm;
  const h = element.hMm * pxPerMm;
  const strokeWidth = (element.strokeWidthMm ?? 0) * pxPerMm;
  const paint = { fill: element.fill ?? 'transparent', stroke: element.stroke ?? undefined, strokeWidth, strokeUniform: true };
  if (element.shape === 'ellipse') return new Ellipse({ ...props, ...paint, rx: w / 2, ry: h / 2 });
  if (element.shape === 'line') {
    // A line is a thin filled bar — simpler to hit and to resize than fabric.Line.
    return new Rect({ ...props, width: w, height: Math.max(h, 0.2 * pxPerMm), fill: element.stroke ?? element.fill ?? '#000000' });
  }
  const radius = (element.radiusMm ?? 0) * pxPerMm;
  return new Rect({ ...props, ...paint, width: w, height: h, rx: radius, ry: radius });
}

export function buildObject(element: DesignElement, pxPerMm: number, images: ImageCache, interactive = true): FabricObject {
  let object: FabricObject;
  if (element.type === 'text') object = buildText(element, pxPerMm, interactive);
  else if (element.type === 'image') object = buildImage(element, pxPerMm, interactive, images);
  else object = buildShape(element, pxPerMm, interactive);
  return tag(object, element.id);
}

// Folds a user's move/resize/rotate back into the element (mm). Text and
// shapes have their scale "baked" into width/font size so the next build
// starts from scale 1 again.
export function readBack(object: FabricObject, element: DesignElement, pxPerMm: number): DesignElement {
  const center = object.getCenterPoint();
  if (element.type === 'text' && object instanceof Textbox) {
    const scaleY = object.scaleY ?? 1;
    const scaleX = object.scaleX ?? 1;
    const width = object.width * scaleX;
    const fontSize = object.fontSize * scaleY;
    const height = object.height * scaleY;
    return {
      ...element,
      text: object.text ?? element.text,
      wMm: width / pxPerMm,
      hMm: height / pxPerMm,
      xMm: center.x / pxPerMm - width / pxPerMm / 2,
      yMm: center.y / pxPerMm - height / pxPerMm / 2,
      rotation: Math.round((object.angle ?? 0) * 100) / 100,
      fontSizePt: Math.round((fontSize / pxPerMm / PT_TO_MM) * 10) / 10,
    };
  }
  const width = object.width * (object.scaleX ?? 1);
  const height = object.height * (object.scaleY ?? 1);
  return {
    ...element,
    wMm: width / pxPerMm,
    hMm: height / pxPerMm,
    xMm: center.x / pxPerMm - width / pxPerMm / 2,
    yMm: center.y / pxPerMm - height / pxPerMm / 2,
    rotation: Math.round((object.angle ?? 0) * 100) / 100,
  };
}

export function pageBackgroundColor(template: DesignTemplate, page: DesignPage): string {
  if (typeof page.background === 'string') return page.background;
  if (page.background?.color) return page.background.color;
  return template.page.background ?? '#ffffff';
}

// Draws one whole page (background + elements) onto a canvas. Used by the
// editor (interactive) and the exporter (static, high DPI).
export function renderPage(
  canvas: StaticCanvas,
  template: DesignTemplate,
  page: DesignPage,
  pxPerMm: number,
  images: ImageCache,
  interactive: boolean,
) {
  canvas.clear();
  canvas.backgroundColor = pageBackgroundColor(template, page);
  if (page.background && typeof page.background === 'object') {
    const source = images.get(page.background.imageUrl);
    if (source?.naturalWidth) {
      const pageW = template.page.widthMm * pxPerMm;
      const pageH = template.page.heightMm * pxPerMm;
      const scale = Math.max(pageW / source.naturalWidth, pageH / source.naturalHeight);
      canvas.backgroundImage = new FabricImage(source, {
        left: pageW / 2, top: pageH / 2, scaleX: scale, scaleY: scale,
      });
    }
  } else {
    canvas.backgroundImage = undefined;
  }
  for (const element of page.elements) canvas.add(buildObject(element, pxPerMm, images, interactive));
  canvas.requestRenderAll();
}

export function collectImageSources(pages: DesignPage[]): string[] {
  const sources = new Set<string>();
  for (const page of pages) {
    if (page.background && typeof page.background === 'object') sources.add(page.background.imageUrl);
    for (const element of page.elements) if (element.type === 'image') sources.add(element.src);
  }
  return [...sources];
}
