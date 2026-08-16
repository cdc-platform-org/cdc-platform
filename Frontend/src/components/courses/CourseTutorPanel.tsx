import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Bot, Sparkles, Send, X, RotateCcw, ChevronLeft } from 'lucide-react';
import { askCourseTutor, TutorChatTurn } from '../../services/courseService';

interface CourseTutorPanelProps {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  lang: 'ka' | 'en';
}

const DICT = {
  ka: {
    title: 'AI კურსის რეპეტიტორი',
    online: 'ონლაინ',
    welcome: (lesson: string) => `გამარჯობა! მზად ვარ დაგეხმაროთ გაკვეთილში „${lesson}“. რა გაინტერესებთ?`,
    placeholder: 'დასვით შეკითხვა...',
    clear: 'საუბრის გასუფთავება',
    close: 'დახურვა',
    open: 'AI რეპეტიტორს ვთხოვ დახმარებას',
    thinking: 'ფიქრობს…',
    error: 'უკაცრავად, პასუხის მიღება ვერ მოხერხდა. სცადეთ ხელახლა.',
    overloaded: 'AI ასისტენტი დროებით გადატვირთულია. გთხოვთ, სცადოთ ხელახლა 1-2 წუთში.',
    retry: 'თავიდან ცდა',
    chips: ['ამიხსენი ეს გაკვეთილი მარტივად', 'დამეხმარე დავალების გაგებაში', 'კოდის შემოწმება / Debugging'],
  },
  en: {
    title: 'AI Course Tutor',
    online: 'Online',
    welcome: (lesson: string) => `Hi! I'm here to help with "${lesson}". What would you like to know?`,
    placeholder: 'Ask a question...',
    clear: 'Clear conversation',
    close: 'Close',
    open: 'Ask the AI Tutor',
    thinking: 'Thinking…',
    error: "Sorry, I couldn't get a response. Please try again.",
    overloaded: 'AI Assistant is experiencing high traffic. Please try again in a moment.',
    retry: 'Retry',
    chips: ['Explain this lesson simply', 'Help me understand the assignment', 'Code review / Debugging'],
  },
} as const;

interface DisplayMessage extends TutorChatTurn {
  id: string;
}

const markdownComponents: Components = {
  p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-bold" {...props} />,
  a: (props) => <a className="underline text-cyan-400" target="_blank" rel="noopener noreferrer" {...props} />,
  code(props) {
    const { children, className, ...rest } = props as { children?: React.ReactNode; className?: string; inline?: boolean };
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-[13px]" {...rest}>
          {children}
        </code>
      );
    }
    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match?.[1] ?? 'text'}
        PreTag="div"
        customStyle={{ borderRadius: '0.75rem', fontSize: '12.5px', margin: '0.5rem 0' }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  },
};

export default function CourseTutorPanel({ courseId, lessonId, courseTitle, lessonTitle, lang }: CourseTutorPanelProps) {
  const t = DICT[lang];
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever the student moves to a different lesson
  // — the tutor's context (system prompt built server-side) is scoped to
  // exactly one lesson, so a stale history from a previous lesson would be
  // actively misleading to keep around.
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [lessonId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: DisplayMessage = { id: crypto.randomUUID(), role: 'USER', content: trimmed };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);
    setLastFailedMessage(null);
    try {
      // askCourseTutor already retries once itself on a 502 (Gemini-side
      // failure, most often the "high demand" 503 this model returns) — by
      // the time an error reaches here, that automatic retry has already
      // been exhausted. A 502 specifically gets the friendly overload
      // message + manual Retry button below; anything else keeps the
      // generic error copy, since a retry can't fix e.g. a real server bug.
      const reply = await askCourseTutor({ courseId, lessonId, userMessage: trimmed, chatHistory: history });
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'ASSISTANT', content: reply }]);
    } catch (err: any) {
      setError(err?.response?.status === 502 ? t.overloaded : t.error);
      setLastFailedMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={t.open}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm px-5 py-3.5 shadow-lg shadow-cyan-500/30 border-none cursor-pointer hover:-translate-y-0.5 transition-all"
      >
        <Sparkles className="w-4 h-4" />
        {t.open}
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] flex flex-col bg-slate-900/90 backdrop-blur-xl border-l border-white/10 shadow-2xl">
      {/* HEADER */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{t.title}</p>
            <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {t.online}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMessages([])}
            aria-label={t.clear}
            title={t.clear}
            className="p-2 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label={t.close}
            title={t.close}
            className="p-2 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        <div className="flex gap-2.5">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-slate-200 max-w-[85%]">
            {t.welcome(lessonTitle)}
          </div>
        </div>

        {messages.map((m) =>
          m.role === 'USER' ? (
            <div key={m.id} className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-slate-200 max-w-[85%] overflow-x-auto">
                <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
              </div>
            </div>
          )
        )}

        {sending && (
          <div className="flex gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3 text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="ml-1">{t.thinking}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-xs text-red-400">{error}</p>
            {lastFailedMessage && (
              <button
                type="button"
                onClick={() => send(lastFailedMessage)}
                className="mt-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-transparent border-none cursor-pointer underline"
              >
                {t.retry}
              </button>
            )}
          </div>
        )}
      </div>

      {/* QUICK PROMPT CHIPS */}
      <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
        {t.chips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={sending}
            onClick={() => send(chip)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/50 hover:text-white disabled:opacity-40 cursor-pointer transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* INPUT */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="shrink-0 flex items-center gap-2 px-4 py-4 border-t border-white/10"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white flex items-center justify-center border-none cursor-pointer disabled:opacity-40 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
