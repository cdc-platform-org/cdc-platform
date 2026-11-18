/**
 * AI mentor side panel of the Design Studio. Sends the question plus the
 * current mode/tool (from editorBridge.editorContext) to /api/ai/design-mentor;
 * the backend replies in the site language passed as `locale`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { askDesignMentor, DesignMentorTurn } from '../../../services/designMentorService';
import type { StudioMode } from './editorBridge';
import type { StudioStrings } from './strings';

interface Props {
  locale: string;
  mode: StudioMode;
  t: StudioStrings;
  getContext: () => { activeTool?: string; documentInfo?: string };
  onClose: () => void;
}

export default function MentorPanel({ locale, mode, t, getContext, onClose }: Props) {
  const [history, setHistory] = useState<DesignMentorTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, busy]);

  const quick = mode === 'photo'
    ? [t.quickPhoto1, t.quickPhoto2, t.quickPhoto3]
    : [t.quickVector1, t.quickVector2, t.quickVector3];

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError('');
    setInput('');
    const prior = history;
    setHistory([...prior, { role: 'USER', content: message }]);
    setBusy(true);
    try {
      const reply = await askDesignMentor({ locale, mode, ...getContext(), message, history: prior });
      setHistory((h) => [...h, { role: 'ASSISTANT', content: reply }]);
    } catch {
      setError(t.mentorError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-[#111113] bg-[#26262a] text-[13px] text-[#e8e8ec]" aria-label={t.mentor}>
      <header className="flex items-center gap-2 border-b border-[#111113] px-3 py-2">
        <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
        <span className="font-semibold">{t.mentor}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label={t.close}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {history.length === 0 && (
          <>
            <p className="leading-relaxed text-zinc-300">{t.mentorIntro}</p>
            <div className="flex flex-col gap-2">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)}
                  className="rounded-md border border-zinc-600 px-3 py-2 text-left text-zinc-200 hover:border-cyan-400 hover:text-white">
                  {q}
                </button>
              ))}
            </div>
          </>
        )}
        {history.map((turn, i) => (
          <div key={i} className={turn.role === 'USER'
            ? 'ml-6 rounded-lg bg-cyan-500/15 px-3 py-2 text-cyan-50'
            : 'mr-2 whitespace-pre-wrap rounded-lg bg-[#323238] px-3 py-2 leading-relaxed'}>
            {turn.content}
          </div>
        ))}
        {busy && <div className="text-zinc-400">{t.thinking}</div>}
        {error && <div className="rounded bg-red-500/15 px-3 py-2 text-red-200" role="alert">{error}</div>}
      </div>

      <form className="flex gap-2 border-t border-[#111113] p-3" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder={t.mentorPlaceholder}
          rows={2}
          maxLength={2000}
          className="flex-1 resize-none rounded-md border border-zinc-600 bg-[#1e1e21] px-2 py-1.5 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t.send}
          className="self-end rounded-md bg-cyan-500 p-2 text-[#0b2530] hover:bg-cyan-400 disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
