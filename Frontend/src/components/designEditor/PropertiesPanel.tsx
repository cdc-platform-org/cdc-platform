// Right-hand panel of the design editor: edits the selected element's
// properties (text, font, colors, photo…) or, with nothing selected, the
// page background. Pure UI — every change goes back through `onChange`.
import { useRef } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, Bold, Copy, ImageUp, Italic, Trash2, Underline,
} from 'lucide-react';
import type { DesignElement, ImageElement, ShapeElement, TextElement } from '../../types/designTemplate';
import { DESIGN_FONT_FAMILIES } from '../../types/designTemplate';
import { DESIGN_FONT_LABELS, fontStack } from './fonts';
import type { DesignEditorDict } from './i18n';

interface Props {
  t: DesignEditorDict;
  element: DesignElement | undefined;
  pageBackground: string;
  uploading: boolean;
  onChange: (patch: Partial<DesignElement>) => void;
  onPageBackground: (color: string) => void;
  onReplaceImage: (file: File) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: 1 | -1) => void;
}

const field = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const input = 'w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm';
const iconButton = (active = false) =>
  `inline-flex items-center justify-center h-8 w-8 rounded-md border text-sm ${active
    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
    : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`;

function ColorInput({ label, value, onChange, allowNone, noneLabel }: {
  label: string; value: string | null | undefined; onChange: (value: string | null) => void; allowNone?: boolean; noneLabel?: string;
}) {
  return (
    <div>
      <span className={field}>{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={(value ?? '#ffffff').slice(0, 7)} onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent" />
        <input className={input} value={value ?? ''} placeholder={noneLabel} aria-label={label}
          onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v); }} />
        {allowNone && (
          <button type="button" className="text-xs underline whitespace-nowrap" onClick={() => onChange(null)}>{noneLabel}</button>
        )}
      </div>
    </div>
  );
}

function TextControls({ t, element, onChange }: { t: DesignEditorDict; element: TextElement; onChange: Props['onChange'] }) {
  const set = (patch: Partial<TextElement>) => onChange(patch as Partial<DesignElement>);
  const aligns = [
    { value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight }, { value: 'justify', icon: AlignJustify },
  ] as const;
  return (
    <>
      <label className="block">
        <span className={field}>{t.text}</span>
        <textarea className={`${input} min-h-[80px]`} value={element.text} onChange={(e) => set({ text: e.target.value })}
          style={{ fontFamily: fontStack(element.fontFamily) }} />
      </label>
      <label className="block">
        <span className={field}>{t.font}</span>
        <select className={input} value={element.fontFamily} onChange={(e) => set({ fontFamily: e.target.value as TextElement['fontFamily'] })}>
          {DESIGN_FONT_FAMILIES.map((family) => (
            <option key={family} value={family} style={{ fontFamily: fontStack(family) }}>{DESIGN_FONT_LABELS[family]} — ქართული</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={field}>{t.size} (pt)</span>
          <input type="number" min={4} max={400} step={0.5} className={input} value={element.fontSizePt}
            onChange={(e) => { const v = Number(e.target.value); if (v >= 4 && v <= 400) set({ fontSizePt: v }); }} />
        </label>
        <ColorInput label={t.color} value={element.color} onChange={(color) => color && set({ color })} />
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" title={t.bold} aria-label={t.bold} className={iconButton(element.fontWeight === 700)}
          onClick={() => set({ fontWeight: element.fontWeight === 700 ? 400 : 700 })}><Bold size={16} /></button>
        <button type="button" title={t.italic} aria-label={t.italic} className={iconButton(!!element.italic)}
          onClick={() => set({ italic: !element.italic })}><Italic size={16} /></button>
        <button type="button" title={t.underline} aria-label={t.underline} className={iconButton(!!element.underline)}
          onClick={() => set({ underline: !element.underline })}><Underline size={16} /></button>
        <span className="mx-1 w-px bg-slate-300 dark:bg-slate-700" />
        {aligns.map(({ value, icon: Icon }) => (
          <button key={value} type="button" title={`${t.align}: ${value}`} aria-label={`${t.align}: ${value}`}
            className={iconButton((element.align ?? 'left') === value)} onClick={() => set({ align: value })}><Icon size={16} /></button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={field}>{t.lineHeight}</span>
          <input type="number" min={0.5} max={4} step={0.1} className={input} value={element.lineHeight ?? 1.2}
            onChange={(e) => { const v = Number(e.target.value); if (v >= 0.5 && v <= 4) set({ lineHeight: v }); }} />
        </label>
        <label className="block">
          <span className={field}>{t.letterSpacing}</span>
          <input type="number" min={-200} max={2000} step={10} className={input} value={element.letterSpacing ?? 0}
            onChange={(e) => { const v = Number(e.target.value); if (v >= -200 && v <= 2000) set({ letterSpacing: v }); }} />
        </label>
      </div>
    </>
  );
}

function ImageControls({ t, element, uploading, onChange, onReplaceImage }: {
  t: DesignEditorDict; element: ImageElement; uploading: boolean; onChange: Props['onChange']; onReplaceImage: Props['onReplaceImage'];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ImageElement>) => onChange(patch as Partial<DesignElement>);
  return (
    <>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onReplaceImage(file); e.target.value = ''; }} />
      <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm font-medium disabled:opacity-60">
        <ImageUp size={16} /> {uploading ? t.uploading : t.replaceImage}
      </button>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={`${iconButton((element.fit ?? 'cover') === 'cover')} w-auto px-2`} onClick={() => set({ fit: 'cover' })}>{t.fitCover}</button>
        <button type="button" className={`${iconButton(element.fit === 'contain')} w-auto px-2`} onClick={() => set({ fit: 'contain' })}>{t.fitContain}</button>
        <button type="button" className={`${iconButton(element.clip === 'circle')} w-auto px-2`}
          onClick={() => set({ clip: element.clip === 'circle' ? 'rect' : 'circle' })}>{t.circle}</button>
      </div>
    </>
  );
}

function ShapeControls({ t, element, onChange }: { t: DesignEditorDict; element: ShapeElement; onChange: Props['onChange'] }) {
  const set = (patch: Partial<ShapeElement>) => onChange(patch as Partial<DesignElement>);
  if (element.shape === 'line') {
    return <ColorInput label={t.color} value={element.stroke ?? element.fill} onChange={(color) => color && set({ stroke: color, fill: color })} />;
  }
  return (
    <>
      <ColorInput label={t.fill} value={element.fill} allowNone noneLabel={t.noFill} onChange={(fill) => set({ fill })} />
      <ColorInput label={t.stroke} value={element.stroke} allowNone noneLabel={t.noFill}
        onChange={(stroke) => set({ stroke, strokeWidthMm: stroke ? Math.max(element.strokeWidthMm ?? 0, 0.5) : 0 })} />
    </>
  );
}

export default function PropertiesPanel(props: Props) {
  const { t, element } = props;
  if (!element) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.nothingSelected}</p>
        <ColorInput label={t.pageBackground} value={props.pageBackground} onChange={(color) => color && props.onPageBackground(color)} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {element.label && <p className="text-sm font-semibold">{element.label}</p>}
      {element.type === 'text' && <TextControls t={t} element={element} onChange={props.onChange} />}
      {element.type === 'image' && (
        <ImageControls t={t} element={element} uploading={props.uploading} onChange={props.onChange} onReplaceImage={props.onReplaceImage} />
      )}
      {element.type === 'shape' && <ShapeControls t={t} element={element} onChange={props.onChange} />}
      <label className="block">
        <span className={field}>{t.opacity}: {Math.round((element.opacity ?? 1) * 100)}%</span>
        <input type="range" min={0.1} max={1} step={0.05} value={element.opacity ?? 1} className="w-full"
          onChange={(e) => props.onChange({ opacity: Number(e.target.value) })} />
      </label>
      <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button type="button" title={t.bringForward} aria-label={t.bringForward} className={iconButton()} onClick={() => props.onMove(1)}><ArrowUp size={16} /></button>
        <button type="button" title={t.sendBackward} aria-label={t.sendBackward} className={iconButton()} onClick={() => props.onMove(-1)}><ArrowDown size={16} /></button>
        <button type="button" title={t.duplicate} aria-label={t.duplicate} className={iconButton()} onClick={props.onDuplicate}><Copy size={16} /></button>
        {!element.locked && (
          <button type="button" title={t.remove} aria-label={t.remove} className={`${iconButton()} text-red-600`} onClick={props.onRemove}><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  );
}
