// ============================================================
// Design document state for the editor: the current document, undo/redo
// history and debounced autosave to PUT /api/designs/:id.
// Canvas wiring lives in DesignEditor.tsx; this hook knows nothing about Fabric.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignTemplate } from '../../types/designTemplate';
import { saveDesign } from '../../services/designService';

const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY_MS = 1500;

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export function useDesignDocument(designId: string, initial: DesignTemplate) {
  const [doc, setDoc] = useState<DesignTemplate>(initial);
  const docRef = useRef(doc);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!dirty.current) return;
    // Serialize saves so an older document never lands after a newer one.
    if (saving.current) await saving.current;
    dirty.current = false;
    setSaveState('saving');
    const snapshot = docRef.current;
    // doc.title doubles as the design's name in "My designs".
    saving.current = saveDesign(designId, snapshot, snapshot.title?.trim() || undefined)
      .then(() => setSaveState(dirty.current ? 'unsaved' : 'saved'))
      .catch(() => { dirty.current = true; setSaveState('error'); })
      .finally(() => { saving.current = null; });
    await saving.current;
  }, [designId]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, AUTOSAVE_DELAY_MS);
  }, [flush]);

  // `record: false` updates the document without an undo step (used while
  // the user is typing; the step is recorded when editing ends).
  const lastRecord = useRef<{ key: string; at: number } | null>(null);
  // `coalesce`: consecutive changes with the same key within a second (e.g.
  // typing in the panel's text box) become a single undo step.
  const update = useCallback((next: DesignTemplate, options: { record?: boolean; coalesce?: string } = {}) => {
    const now = Date.now();
    const merged = !!options.coalesce && lastRecord.current?.key === options.coalesce && now - lastRecord.current.at < 1000;
    lastRecord.current = options.coalesce ? { key: options.coalesce, at: now } : null;
    if (options.record !== false && !merged) {
      past.current.push(JSON.stringify(docRef.current));
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      setHistoryTick((tick) => tick + 1);
    }
    docRef.current = next;
    setDoc(next);
    scheduleSave();
  }, [scheduleSave]);

  // Records an undo step for a change that was applied silently earlier.
  const recordSnapshot = useCallback((before: DesignTemplate) => {
    past.current.push(JSON.stringify(before));
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    setHistoryTick((tick) => tick + 1);
  }, []);

  const step = useCallback((from: React.MutableRefObject<string[]>, to: React.MutableRefObject<string[]>) => {
    const previous = from.current.pop();
    if (!previous) return null;
    to.current.push(JSON.stringify(docRef.current));
    const next = JSON.parse(previous) as DesignTemplate;
    docRef.current = next;
    setDoc(next);
    setHistoryTick((tick) => tick + 1);
    scheduleSave();
    return next;
  }, [scheduleSave]);

  const undo = useCallback(() => step(past, future), [step]);
  const redo = useCallback(() => step(future, past), [step]);

  const replace = useCallback((next: DesignTemplate) => {
    past.current = [];
    future.current = [];
    docRef.current = next;
    setDoc(next);
    setHistoryTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty.current && !saving.current) return;
      void flush();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [flush]);

  // Save whatever is pending when the editor unmounts (in-app navigation).
  useEffect(() => () => { void flush(); }, [flush]);

  return {
    doc, docRef, update, recordSnapshot, undo, redo, replace, flush, saveState,
    canUndo: past.current.length > 0, canRedo: future.current.length > 0, historyTick,
  };
}
