// Design editor chrome: the top bar (title, save state, undo/redo, zoom,
// add-element tools, downloads) and the pages list. Pure UI; DesignEditor.tsx
// owns the state.
import Link from 'next/link';
import {
  ArrowLeft, ChevronDown, ChevronUp, Circle, Copy, Download, FileText, ImagePlus, Minus, Plus, Redo2, RotateCcw, Square, Trash2, Type, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { DesignEditorDict } from './i18n';
import type { SaveState } from './useDesignDocument';

const button = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';

interface TopBarProps {
  t: DesignEditorDict;
  title: string;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  exporting: string | null;
  uploading: boolean;
  vectorPage: boolean;
  transparentExport: boolean;
  onTransparentExport: (value: boolean) => void;
  onTitle: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onAdd: (kind: 'text' | 'rect' | 'ellipse' | 'line') => void;
  onAddImage: (file: File) => void;
  onReset: () => void;
  onExport: (kind: 'png' | 'pdf' | 'svg') => void;
}

export function EditorTopBar(props: TopBarProps) {
  const { t } = props;
  const saveLabel = { saved: t.saved, saving: t.saving, unsaved: t.unsaved, error: t.saveError }[props.saveState];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
      <Link href="/dashboard/designs" className={button} aria-label={t.back}><ArrowLeft size={16} /></Link>
      <input value={props.title} maxLength={120} aria-label="Title" onChange={(e) => props.onTitle(e.target.value)}
        className="min-w-0 flex-1 sm:flex-none sm:w-56 rounded-md border border-transparent hover:border-slate-300 focus:border-slate-400 dark:hover:border-slate-700 bg-transparent px-2 py-1 font-semibold" />
      <span className={`text-xs ${props.saveState === 'error' ? 'text-red-600' : 'text-slate-500'}`} aria-live="polite">{saveLabel}</span>

      <div className="flex items-center gap-1 sm:ml-2">
        <button type="button" className={button} title={t.undo} aria-label={t.undo} disabled={!props.canUndo} onClick={props.onUndo}><Undo2 size={16} /></button>
        <button type="button" className={button} title={t.redo} aria-label={t.redo} disabled={!props.canRedo} onClick={props.onRedo}><Redo2 size={16} /></button>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className={button} onClick={() => props.onAdd('text')}><Type size={16} /><span className="hidden md:inline">{t.addText}</span></button>
        <label className={`${button} cursor-pointer`}>
          <ImagePlus size={16} /><span className="hidden md:inline">{props.uploading ? t.uploading : t.addImage}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={props.uploading}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) props.onAddImage(file); e.target.value = ''; }} />
        </label>
        <button type="button" className={button} title={t.addRect} aria-label={t.addRect} onClick={() => props.onAdd('rect')}><Square size={16} /></button>
        <button type="button" className={button} title={t.addEllipse} aria-label={t.addEllipse} onClick={() => props.onAdd('ellipse')}><Circle size={16} /></button>
        <button type="button" className={button} title={t.addLine} aria-label={t.addLine} onClick={() => props.onAdd('line')}><Minus size={16} /></button>
      </div>

      <div className="flex items-center gap-1">
        <button type="button" className={button} title={t.zoomOut} aria-label={t.zoomOut} onClick={() => props.onZoom(-0.25)}><ZoomOut size={16} /></button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(props.zoom * 100)}%</span>
        <button type="button" className={button} title={t.zoomIn} aria-label={t.zoomIn} onClick={() => props.onZoom(0.25)}><ZoomIn size={16} /></button>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {props.vectorPage && <>
          <label className="inline-flex items-center gap-1.5 px-2 text-xs">
            <input type="checkbox" checked={props.transparentExport} onChange={event => props.onTransparentExport(event.target.checked)} />
            {t.transparentBackground}
          </label>
          <button type="button" className={button} disabled={!!props.exporting} onClick={() => props.onExport('svg')}>
            <Download size={16} />{props.exporting === 'svg' ? t.exporting : t.downloadSvg}
          </button>
        </>}
        <button type="button" className={button} title={t.resetDesign} aria-label={t.resetDesign} onClick={props.onReset}><RotateCcw size={16} /></button>
        <button type="button" className={button} disabled={!!props.exporting} onClick={() => props.onExport('png')}>
          <Download size={16} />{props.exporting === 'png' ? t.exporting : t.downloadPng}
        </button>
        <button type="button" disabled={!!props.exporting} onClick={() => props.onExport('pdf')}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-60">
          <FileText size={16} />{props.exporting === 'pdf' ? t.exporting : t.downloadPdf}
        </button>
      </div>
    </div>
  );
}

interface PagesProps {
  t: DesignEditorDict;
  count: number;
  current: number;
  maxPages: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: 1 | -1) => void;
}

export function PagesPanel(props: PagesProps) {
  const { t } = props;
  const small = 'inline-flex items-center justify-center h-7 w-7 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.pages}</p>
      <ol className="flex lg:flex-col gap-1 overflow-x-auto">
        {Array.from({ length: props.count }, (_, index) => (
          <li key={index}>
            <button type="button" onClick={() => props.onSelect(index)} aria-current={index === props.current}
              className={`w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm border ${index === props.current
                ? 'border-slate-900 dark:border-white font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {t.page} {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={small} title={t.addPage} aria-label={t.addPage} disabled={props.count >= props.maxPages} onClick={props.onAdd}><Plus size={14} /></button>
        <button type="button" className={small} title={t.duplicatePage} aria-label={t.duplicatePage} disabled={props.count >= props.maxPages} onClick={props.onDuplicate}><Copy size={14} /></button>
        <button type="button" className={small} title={t.moveUp} aria-label={t.moveUp} disabled={props.current === 0} onClick={() => props.onMove(-1)}><ChevronUp size={14} /></button>
        <button type="button" className={small} title={t.moveDown} aria-label={t.moveDown} disabled={props.current >= props.count - 1} onClick={() => props.onMove(1)}><ChevronDown size={14} /></button>
        <button type="button" className={`${small} text-red-600`} title={t.deletePage} aria-label={t.deletePage} disabled={props.count <= 1} onClick={props.onRemove}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
