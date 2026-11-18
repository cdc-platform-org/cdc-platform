/**
 * CDC Design Studio: one workspace with two professional editors and a switch.
 *   Photo  = raster editor (miniPaint, /public/studio/photo)  — Photoshop-style
 *   Vector = vector editor (SVG-Edit, /public/studio/vector)  — Illustrator-style
 * Both run in same-origin iframes that stay mounted once opened, so switching
 * modes keeps each document. Work moves between modes as a new layer/image
 * (editorBridge.ts). The AI mentor (MentorPanel.tsx) answers in the site locale.
 * Used by /dashboard/tools/design-studio, the course player and live classroom.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Download, Image as ImageIcon, Maximize2, Minimize2, PenTool, Sparkles, Upload } from 'lucide-react';
import MentorPanel from './MentorPanel';
import { studioStrings } from './strings';
import {
  StudioMode, editorContext, editorUrl, exportWork, fitVectorArtboard, insertImageIntoPhoto,
  insertImageIntoVector, isEditorReady, photoCanvas, vectorToPngDataUrl,
} from './editorBridge';

export interface DesignStudioProps {
  lang?: string;
  /** When set (course player), shows "Submit assignment" with the current work as a file. */
  onSubmitWork?: (file: File) => Promise<void>;
  initialMode?: StudioMode;
}

export default function DesignStudio({ lang = 'ka', onSubmitWork, initialMode = 'photo' }: DesignStudioProps) {
  const t = studioStrings(lang);
  const rootRef = useRef<HTMLDivElement>(null);
  const frames = { photo: useRef<HTMLIFrameElement>(null), vector: useRef<HTMLIFrameElement>(null) };
  const [mode, setMode] = useState<StudioMode>(initialMode);
  const [opened, setOpened] = useState<Record<StudioMode, boolean>>({ photo: initialMode === 'photo', vector: initialMode === 'vector' });
  const [ready, setReady] = useState<Record<StudioMode, boolean>>({ photo: false, vector: false });
  const [mentorOpen, setMentorOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  // Ready signals: postMessage from each editor page, with polling as a fallback.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'ready') return;
      if (e.data.source === 'cdc-photo') setReady((r) => ({ ...r, photo: true }));
      if (e.data.source === 'cdc-vector') setReady((r) => ({ ...r, vector: true }));
    };
    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => {
      setReady((r) => ({
        photo: r.photo || isEditorReady('photo', frames.photo.current),
        vector: r.vector || isEditorReady('vector', frames.vector.current),
      }));
    }, 500);
    return () => { window.removeEventListener('message', onMessage); window.clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // The vector editor was laid out while hidden; re-fit its artboard when shown.
  useEffect(() => {
    if (mode === 'vector' && ready.vector) fitVectorArtboard(frames.vector.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready.vector]);

  const switchTo = (next: StudioMode) => {
    setOpened((o) => ({ ...o, [next]: true }));
    setMode(next);
  };


  async function transfer() {
    if (!ready[mode]) return flash(t.notReady);
    setBusy(true);
    try {
      if (mode === 'photo') {
        const canvas = photoCanvas(frames.photo.current);
        if (!canvas) throw new Error('no canvas');
        switchTo('vector');
        await waitFor(() => isEditorReady('vector', frames.vector.current));
        insertImageIntoVector(frames.vector.current, canvas.toDataURL('image/png'), canvas.width, canvas.height);
      } else {
        const png = await vectorToPngDataUrl(frames.vector.current);
        if (!png) throw new Error('no svg');
        switchTo('photo');
        await waitFor(() => isEditorReady('photo', frames.photo.current));
        await insertImageIntoPhoto(frames.photo.current, png, 'Vector');
      }
      flash(t.sent);
    } catch {
      flash(t.notReady);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!ready[mode]) return flash(t.notReady);
    const file = await exportWork(mode, frames[mode].current);
    if (!file) return flash(t.notReady);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function submit() {
    if (!onSubmitWork) return;
    if (!ready[mode]) return flash(t.notReady);
    setBusy(true);
    try {
      const file = await exportWork(mode, frames[mode].current);
      if (!file) throw new Error('export failed');
      await onSubmitWork(file);
      flash(t.submitted);
    } catch {
      flash(t.submitFailed);
    } finally {
      setBusy(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  const modeButton = (m: StudioMode, Icon: typeof ImageIcon, label: string, hint: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      title={hint}
      onClick={() => switchTo(m)}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors ${
        mode === m ? 'bg-cyan-500 text-[#0b2530] shadow-sm' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );

  const toolButton = 'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] text-zinc-200 hover:bg-white/10 hover:text-white disabled:opacity-40';

  return (
    <div
      ref={rootRef}
      className={`flex flex-col overflow-hidden bg-[#1e1e21] text-[#e8e8ec] ${fullscreen ? 'h-screen' : 'h-[calc(100vh-140px)] min-h-[640px] rounded-xl border border-[#111113] shadow-2xl'}`}
    >
      {/* Application bar: brand, mode switch, cross-mode transfer, export, mentor */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#111113] bg-[#19191c] px-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark */}
        <img src="/studio/vector/images/logo.svg" alt="" className="h-6 w-6" />
        <span className="hidden whitespace-nowrap text-[13px] font-semibold sm:inline">{t.brand}</span>

        <div role="tablist" aria-label={t.brand} className="ml-2 flex rounded-md bg-[#2f2f33] p-0.5">
          {modeButton('photo', ImageIcon, t.photo, t.photoHint)}
          {modeButton('vector', PenTool, t.vector, t.vectorHint)}
        </div>

        <button type="button" className={toolButton} onClick={transfer} disabled={busy} title={mode === 'photo' ? t.sendToVector : t.sendToPhoto}>
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          <span className="hidden xl:inline">{mode === 'photo' ? t.sendToVector : t.sendToPhoto}</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={toolButton} onClick={download} title={t.download}>
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden xl:inline">{t.download}</span>
          </button>
          {onSubmitWork && (
            <button type="button" onClick={submit} disabled={busy}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-violet-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-violet-500 disabled:opacity-50">
              <Upload className="h-4 w-4" aria-hidden />
              {busy ? t.submitting : t.submit}
            </button>
          )}
          <button type="button" onClick={() => setMentorOpen((v) => !v)} aria-pressed={mentorOpen}
            className={`${toolButton} ${mentorOpen ? 'bg-cyan-500/20 text-cyan-200' : ''}`}>
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">{t.mentor}</span>
          </button>
          <button type="button" className={toolButton} onClick={toggleFullscreen} title={fullscreen ? t.exitFullscreen : t.fullscreen} aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Editors stay mounted after first open; the inactive one is only hidden. */}
        <div className="relative min-w-0 flex-1">
          {(['photo', 'vector'] as StudioMode[]).map((m) => opened[m] && (
            <iframe
              key={m}
              ref={frames[m]}
              src={editorUrl(m, lang)}
              title={m === 'photo' ? t.photo : t.vector}
              className="absolute inset-0 h-full w-full border-0"
              style={{ visibility: mode === m ? 'visible' : 'hidden', zIndex: mode === m ? 1 : 0 }}
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ))}
          {!ready[mode] && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#1e1e21] text-sm text-zinc-400">
              {t.loading}
            </div>
          )}
          {toast && (
            <div role="status" className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
              {toast}
            </div>
          )}
        </div>

        {mentorOpen && (
          <MentorPanel
            locale={lang}
            mode={mode}
            t={t}
            getContext={() => editorContext(mode, frames[mode].current)}
            onClose={() => setMentorOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function waitFor(check: () => boolean, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('timeout'));
      window.setTimeout(tick, 150);
    };
    tick();
  });
}
