// ============================================================
// The design editor screen (client-only; loaded with ssr:false from
// pages/dashboard/designs/[id].tsx). Wires the Fabric.js canvas to the design
// document:
//   - useDesignDocument.ts  document state, undo/redo, autosave
//   - fabricMapping.ts      element <-> Fabric object conversion
//   - docOps.ts             pure document edits
//   - EditorChrome.tsx / PropertiesPanel.tsx   UI around the canvas
//   - exportDesign.ts       PNG/PDF download
// The canvas always shows ONE page and is rebuilt from the document after
// every change (cheap: a page has at most a few dozen objects), so the
// document stays the single source of truth.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type FabricObject, Textbox } from 'fabric';
import type { DesignElement, DesignTemplate } from '../../types/designTemplate';
import type { DesignRecord } from '../../services/designService';
import { resetDesign, uploadDesignImage, exportDesignSvg } from '../../services/designService';
import { useDesignDocument } from './useDesignDocument';
import { collectImageSources, elementIdOf, pageBackgroundColor, readBack, renderPage } from './fabricMapping';
import * as ops from './docOps';
import { createImageLoader, type ImageLoader } from './imageLoader';
import { ensureDesignFontsLoaded } from './fonts';
import { downloadBlob, exportPagePng, exportPdf, safeFilename } from './exportDesign';
import { EditorTopBar, PagesPanel } from './EditorChrome';
import PropertiesPanel from './PropertiesPanel';
import type { DesignEditorDict } from './i18n';

const MAX_PAGES = 30;
const CANVAS_PADDING_PX = 32;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export default function DesignEditor({ record, t }: { record: DesignRecord; t: DesignEditorDict }) {
  const initial = useMemo<DesignTemplate>(() => ({ ...record.data, title: record.title }), [record]);
  const { doc, docRef, update, recordSnapshot, undo, redo, replace, saveState, canUndo, canRedo } = useDesignDocument(record.id, initial);

  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(2);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [transparentExport, setTransparentExport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const loaderRef = useRef<ImageLoader | null>(null);
  const pxPerMm = fitScale * zoom;
  // Refs mirror state for Fabric event handlers, which are bound once.
  const live = useRef({ pageIndex, selectedId, pxPerMm });
  live.current = { pageIndex, selectedId, pxPerMm };
  const rebuilding = useRef(false);
  const skipRebuild = useRef(false);
  const textEditStart = useRef<DesignTemplate | null>(null);
  const rebuildToken = useRef(0);

  // ---- Fabric canvas lifecycle + events --------------------------------
  useEffect(() => {
    if (!canvasElRef.current) return undefined;
    const canvas = new Canvas(canvasElRef.current, { preserveObjectStacking: true, selection: false });
    canvasRef.current = canvas;
    loaderRef.current = createImageLoader(record.id);

    const onSelect = (selected: FabricObject[] | undefined) => {
      if (!rebuilding.current) setSelectedId(selected?.[0] ? elementIdOf(selected[0]) ?? null : null);
    };
    canvas.on('selection:created', (e) => onSelect(e.selected));
    canvas.on('selection:updated', (e) => onSelect(e.selected));
    canvas.on('selection:cleared', () => onSelect(undefined));

    canvas.on('object:modified', (e) => {
      const target = e.target;
      const id = target && elementIdOf(target);
      const current = docRef.current;
      const element = id ? ops.findElement(current, live.current.pageIndex, id) : undefined;
      if (!target || !element) return;
      update(ops.replaceElement(current, live.current.pageIndex, readBack(target, element, live.current.pxPerMm)));
    });

    // Typing directly on the canvas: keep the document in step without
    // rebuilding (that would end the editing session) and record ONE undo
    // step when editing ends.
    canvas.on('text:changed', (e) => {
      const target = e.target;
      const id = elementIdOf(target);
      if (!id) return;
      if (!textEditStart.current) textEditStart.current = docRef.current;
      skipRebuild.current = true;
      update(ops.updateElement(docRef.current, live.current.pageIndex, id, { text: target.text } as Partial<DesignElement>), { record: false });
    });
    canvas.on('text:editing:exited', (e) => {
      const target = e.target;
      const id = elementIdOf(target);
      const before = textEditStart.current;
      textEditStart.current = null;
      const element = id ? ops.findElement(docRef.current, live.current.pageIndex, id) : undefined;
      if (!before || !element) return;
      recordSnapshot(before);
      update(ops.replaceElement(docRef.current, live.current.pageIndex, readBack(target, element, live.current.pxPerMm)), { record: false });
    });

    return () => {
      canvas.dispose();
      loaderRef.current?.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  // ---- Fit the page into the available space ---------------------------
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const width = viewport.clientWidth - CANVAS_PADDING_PX * 2;
      // Site-wide banners above the editor can push it past the window
      // bottom, so fit to what is actually visible.
      const visible = Math.min(viewport.clientHeight, window.innerHeight - viewport.getBoundingClientRect().top);
      const height = Math.max(visible - CANVAS_PADDING_PX * 2, 300);
      const scale = Math.min(width / doc.page.widthMm, height / doc.page.heightMm);
      setFitScale(Math.max(0.5, scale));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [doc.page.widthMm, doc.page.heightMm]);

  // ---- Rebuild the canvas from the document -----------------------------
  const rebuild = useCallback(async () => {
    const canvas = canvasRef.current;
    const loader = loaderRef.current;
    if (!canvas || !loader) return;
    const token = ++rebuildToken.current;
    const current = docRef.current;
    const page = current.pages[Math.min(pageIndex, current.pages.length - 1)];
    await ensureDesignFontsLoaded();
    await loader.ensure(collectImageSources([page]));
    if (token !== rebuildToken.current || canvasRef.current !== canvas) return; // superseded
    rebuilding.current = true;
    canvas.setDimensions({ width: current.page.widthMm * pxPerMm, height: current.page.heightMm * pxPerMm });
    renderPage(canvas, current, page, pxPerMm, loader.cache, true);
    const keep = live.current.selectedId && canvas.getObjects().find((object) => elementIdOf(object) === live.current.selectedId);
    if (keep && keep.selectable) canvas.setActiveObject(keep);
    canvas.requestRenderAll();
    rebuilding.current = false;
  }, [docRef, pageIndex, pxPerMm]);

  useEffect(() => {
    if (skipRebuild.current) { skipRebuild.current = false; return; }
    void rebuild();
  }, [doc, rebuild]);

  // Clamp the page index after an undo/remove shortens the document.
  useEffect(() => {
    if (pageIndex > doc.pages.length - 1) setPageIndex(doc.pages.length - 1);
  }, [doc.pages.length, pageIndex]);

  // ---- Actions -----------------------------------------------------------
  const selected = ops.findElement(doc, pageIndex, selectedId);

  const select = useCallback((id: string | null) => {
    live.current.selectedId = id;
    setSelectedId(id);
  }, []);

  const changeSelected = (patch: Partial<DesignElement>) => {
    if (!selectedId) return;
    const key = Object.keys(patch).join(',');
    update(ops.updateElement(docRef.current, pageIndex, selectedId, patch), { coalesce: `${selectedId}:${key}` });
  };

  const removeSelected = useCallback(() => {
    const id = live.current.selectedId;
    const element = ops.findElement(docRef.current, live.current.pageIndex, id);
    if (!id || !element || element.locked || element.editable === false) return;
    select(null);
    update(ops.removeElement(docRef.current, live.current.pageIndex, id));
  }, [docRef, select, update]);

  const addElement = (kind: 'text' | 'rect' | 'ellipse' | 'line') => {
    const { widthMm, heightMm } = doc.page;
    const w = kind === 'text' ? widthMm * 0.6 : kind === 'line' ? widthMm * 0.4 : Math.min(widthMm, heightMm) * 0.25;
    const h = kind === 'text' ? 12 : kind === 'line' ? 0.6 : kind === 'ellipse' ? w : w * 0.66;
    const base = { id: ops.newId(kind), xMm: (widthMm - w) / 2, yMm: (heightMm - h) / 2, wMm: w, hMm: h };
    const element: DesignElement = kind === 'text'
      ? { ...base, type: 'text', text: t.newText, fontFamily: 'FiraGO', fontSizePt: Math.max(12, Math.round(widthMm / 10)), color: '#111827' }
      : kind === 'line'
        ? { ...base, type: 'shape', shape: 'line', stroke: '#111827', fill: '#111827' }
        : { ...base, type: 'shape', shape: kind, fill: '#3b82f6', stroke: null };
    update(ops.addElement(docRef.current, pageIndex, element));
    select(element.id);
  };

  const uploadImage = async (file: File): Promise<{ ref: string; width: number; height: number } | null> => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDesignImage(record.id, file);
      await loaderRef.current?.put(uploaded.ref, file);
      return uploaded;
    } catch {
      setError(t.uploadFailed);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const addImage = async (file: File) => {
    const uploaded = await uploadImage(file);
    if (!uploaded) return;
    const { widthMm, heightMm } = doc.page;
    const ratio = uploaded.height / uploaded.width;
    let w = widthMm * 0.5;
    let h = w * ratio;
    if (h > heightMm * 0.6) { h = heightMm * 0.6; w = h / ratio; }
    const element: DesignElement = { id: ops.newId('image'), type: 'image', src: uploaded.ref, xMm: (widthMm - w) / 2, yMm: (heightMm - h) / 2, wMm: w, hMm: h, fit: 'cover' };
    update(ops.addElement(docRef.current, pageIndex, element));
    select(element.id);
  };

  const replaceImage = async (file: File) => {
    const id = selectedId;
    const uploaded = await uploadImage(file);
    if (!uploaded || !id) return;
    update(ops.updateElement(docRef.current, pageIndex, id, { src: uploaded.ref, placeholder: false } as Partial<DesignElement>));
  };

  const currentPage = doc.pages[pageIndex] ?? doc.pages[0];
  const vectorPage = typeof currentPage.background !== 'object' && currentPage.elements.every(el => el.type !== 'image');
  const runExport = async (kind: 'png' | 'pdf' | 'svg') => {
    setExporting(kind);
    setError(null);
    try {
      const current = docRef.current;
      const name = safeFilename(current.title || record.title);
      if (kind === 'svg') {
        const blob = await exportDesignSvg(record.id, current, pageIndex, transparentExport);
        downloadBlob(blob, current.pages.length > 1 ? `${name}-${pageIndex + 1}.svg` : `${name}.svg`);
        return;
      }
      await loaderRef.current?.ensure(collectImageSources(current.pages));
      const cache = loaderRef.current!.cache;
      if (kind === 'png') {
        const blob = await exportPagePng(current, pageIndex, cache, vectorPage && transparentExport);
        downloadBlob(blob, current.pages.length > 1 ? `${name}-${pageIndex + 1}.png` : `${name}.png`);
      } else {
        downloadBlob(await exportPdf(current, cache), `${name}.pdf`);
      }
    } catch {
      setError(t.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const startOver = async () => {
    if (!window.confirm(t.confirmReset)) return;
    const fresh = await resetDesign(record.id);
    select(null);
    setPageIndex(0);
    replace({ ...fresh, title: docRef.current.title });
  };

  // ---- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const active = canvasRef.current?.getActiveObject();
      if (isTypingTarget(event.target) || (active instanceof Textbox && active.isEditing)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, removeSelected]);

  const goToPage = (index: number) => { select(null); setPageIndex(index); };

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <EditorTopBar
        t={t} title={doc.title ?? ''} saveState={saveState} canUndo={canUndo} canRedo={canRedo} zoom={zoom}
        exporting={exporting} uploading={uploading}
        vectorPage={vectorPage} transparentExport={transparentExport} onTransparentExport={setTransparentExport}
        onTitle={(title) => update({ ...docRef.current, title }, { coalesce: 'title' })}
        onUndo={undo} onRedo={redo}
        onZoom={(delta) => setZoom((value) => Math.min(4, Math.max(0.25, value + delta)))}
        onAdd={addElement} onAddImage={addImage} onReset={startOver} onExport={runExport}
      />
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200 px-4 py-2 text-sm flex justify-between">
          <span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Close">×</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 lg:w-44 lg:overflow-y-auto">
          <PagesPanel
            t={t} count={doc.pages.length} current={pageIndex} maxPages={MAX_PAGES} onSelect={goToPage}
            onAdd={() => { update(ops.addPage(docRef.current, pageIndex)); goToPage(pageIndex + 1); }}
            onDuplicate={() => { update(ops.addPage(docRef.current, pageIndex, pageIndex)); goToPage(pageIndex + 1); }}
            onRemove={() => { if (window.confirm(t.deletePage + '?')) { update(ops.removePage(docRef.current, pageIndex)); goToPage(Math.max(0, pageIndex - 1)); } }}
            onMove={(direction) => { update(ops.movePage(docRef.current, pageIndex, direction)); setPageIndex(pageIndex + direction); }}
          />
        </aside>
        <div ref={viewportRef} className="order-1 lg:order-2 relative min-h-[55vh] flex-1 overflow-auto">
          <div className="flex min-h-full min-w-fit items-center justify-center" style={{ padding: CANVAS_PADDING_PX }}>
            <div className="shadow-xl ring-1 ring-black/5">
              <canvas ref={canvasElRef} />
            </div>
          </div>
        </div>
        <aside className="order-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:w-80 lg:overflow-y-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.properties}</p>
          <PropertiesPanel
            t={t} element={selected} uploading={uploading}
            pageBackground={pageBackgroundColor(doc, doc.pages[pageIndex] ?? doc.pages[0])}
            onChange={changeSelected}
            onPageBackground={(color) => update(ops.setPageBackground(docRef.current, pageIndex, color), { coalesce: 'bg' })}
            onReplaceImage={replaceImage}
            onDuplicate={() => { if (!selectedId) return; const result = ops.duplicateElement(docRef.current, pageIndex, selectedId); update(result.doc); select(result.newId); }}
            onRemove={removeSelected}
            onMove={(direction) => selectedId && update(ops.moveElement(docRef.current, pageIndex, selectedId, direction))}
          />
        </aside>
      </div>
    </div>
  );
}
