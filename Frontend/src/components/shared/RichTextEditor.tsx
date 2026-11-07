import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { useRouter } from 'next/router';
import DOMPurify from 'dompurify';
import { Bold, Italic, Heading2, List, ListOrdered, Smile, Eye, Pencil } from 'lucide-react';
import MarkdownContent from './MarkdownContent';
import { isHtmlContent, isMarkdownLike, HTML_CONTENT_ALLOWED_TAGS, HTML_CONTENT_ALLOWED_ATTR } from '../../utils/richContent';
import { resolveLocale, contentLocale } from '../../utils/locale';

// This component is shared across ~14 pages spanning several different
// i18next namespaces (educatorHub, blog admin, courses admin, etc.), many of
// which don't preload a common namespace this could safely depend on — a
// useTranslation() call here risks the exact "raw key" bug this fix exists
// to prevent, in whichever pages don't happen to load that namespace. Same
// fix as ToolErrorBoundary.tsx's own DICT: read the app's actual current
// locale straight from the router (the one global, always-available
// language source) and use a small inline dictionary, rather than adding a
// namespace dependency or any independent/local language state.
const RTE_LABELS = {
  ka: {
    preview: 'გადახედვა',
    source: 'წყარო',
    editSourceTooltip: 'წყაროს რედაქტირება',
    previewTooltip: 'გენერირებული შედეგის გადახედვა',
    emptyPreview: 'გადასახედი ჯერ არაფერია.',
  },
  en: {
    preview: 'Preview',
    source: 'Source',
    editSourceTooltip: 'Edit source',
    previewTooltip: 'Preview rendered output',
    emptyPreview: 'Nothing to preview yet.',
  },
} as const;

// Lightweight Markdown-source editor — no Tiptap/Quill dependency (this repo's
// npm workspace can't currently take new packages locally, see apiClient.ts's
// history). Toolbar buttons write Markdown syntax directly into a plain
// <textarea>; pair with <MarkdownContent> to render the result. Drop-in
// replacement for a controlled <textarea value/onChange>.
//
// AI-generated drafts (services/aiAgentService.ts) land here as raw HTML
// (<h2>, <p>, <strong>...), not Markdown — a plain textarea can only ever
// show that as literal tags, never render it. The Preview toggle below
// covers both cases: HTML content is sanitized (DOMPurify, same allowlist
// the public blog page uses) and rendered via dangerouslySetInnerHTML;
// Markdown content renders through the existing MarkdownContent. Whenever
// an external update (AI Generate, loading a different post to edit) drops
// in HTML, the editor jumps straight to Preview so the admin never sees raw
// tags — see the lastEmittedRef/useEffect pair below.

const EMOJI = [
  '😀', '😄', '😊', '😉', '😍', '🤔', '😎', '🙌', '👍', '👏',
  '🔥', '✨', '🎉', '🚀', '💡', '⭐', '✅', '❗', '📌', '📈',
  '💻', '🎨', '📷', '🎓', '💼', '🕒', '📍', '💰', '🤝', '❤️',
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
}

// HTML content always auto-previews (unreadable otherwise); Markdown
// content now does too, so a teacher's first look at freshly AI-generated
// content is the rendered heading/bold/list, never raw "### "/"**" syntax
// (same reasoning the original HTML-only check already documented above).
function shouldAutoPreview(value: string): boolean {
  return isHtmlContent(value) || isMarkdownLike(value);
}

export default function RichTextEditor({ value, onChange, placeholder, rows = 6, required, className = '' }: RichTextEditorProps) {
  const router = useRouter();
  const rt = RTE_LABELS[contentLocale(resolveLocale(router.locale))];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(() => shouldAutoPreview(value));

  // Tracks the last value *this editor* produced, so we can tell "the admin
  // typed a character" apart from "the parent replaced the value out from
  // under us" (AI Generate, or clicking Edit on a different post). Only the
  // latter should auto-flip the view — otherwise every keystroke that
  // happens to start a line with "<" would fight the admin for control.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setPreviewMode(shouldAutoPreview(value));
    }
  }, [value]);

  // Controlled <textarea> updates reset the cursor to the end by default —
  // this restores it to wherever the last toolbar action left it.
  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pending.start, pending.end);
    pendingSelectionRef.current = null;
  }, [value]);

  const applyChange = (newValue: string, selectionStart: number, selectionEnd: number) => {
    pendingSelectionRef.current = { start: selectionStart, end: selectionEnd };
    lastEmittedRef.current = newValue;
    onChange(newValue);
  };

  const wrapSelection = (prefix: string, suffix: string = prefix, placeholderText = 'text') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    applyChange(newValue, start + prefix.length, start + prefix.length + selected.length);
  };

  // Prefixes every line touched by the current selection — e.g. turning a
  // 3-line selection into a 3-item bullet list in one click.
  const prefixLines = (linePrefix: string | ((i: number) => string)) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const newBlock = lines.map((line, i) => `${typeof linePrefix === 'function' ? linePrefix(i) : linePrefix}${line}`).join('\n');
    const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    applyChange(newValue, lineStart, lineStart + newBlock.length);
  };

  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = value.slice(0, start) + text + value.slice(end);
    applyChange(newValue, start + text.length, start + text.length);
  };

  const toolbarButtonClass =
    'inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-gray-500';

  const contentIsHtml = isHtmlContent(value);
  const sanitizedHtml = previewMode && contentIsHtml && typeof window !== 'undefined'
    ? DOMPurify.sanitize(value, { ALLOWED_TAGS: HTML_CONTENT_ALLOWED_TAGS, ALLOWED_ATTR: HTML_CONTENT_ALLOWED_ATTR })
    : '';

  return (
    <div className={`border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700 relative">
        <button type="button" disabled={previewMode} title="Bold" onClick={() => wrapSelection('**')} className={toolbarButtonClass}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" disabled={previewMode} title="Italic" onClick={() => wrapSelection('_')} className={toolbarButtonClass}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" disabled={previewMode} title="Heading" onClick={() => prefixLines('## ')} className={toolbarButtonClass}>
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" disabled={previewMode} title="Bullet list" onClick={() => prefixLines('- ')} className={toolbarButtonClass}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" disabled={previewMode} title="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)} className={toolbarButtonClass}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button type="button" disabled={previewMode} title="Emoji" onClick={() => setEmojiOpen((open) => !open)} className={toolbarButtonClass}>
            <Smile className="w-3.5 h-3.5" />
          </button>
          {emojiOpen && !previewMode && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 grid grid-cols-6 gap-0.5 p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg w-52">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertAtCursor(emoji);
                      setEmojiOpen(false);
                    }}
                    className="text-base p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 bg-transparent border-none cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto">
          <button
            type="button"
            title={previewMode ? rt.editSourceTooltip : rt.previewTooltip}
            onClick={() => setPreviewMode((p) => !p)}
            className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 bg-transparent border-none cursor-pointer"
          >
            {previewMode ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewMode ? rt.source : rt.preview}
          </button>
        </div>
      </div>

      {previewMode ? (
        <div
          className="w-full px-3.5 py-2.5 text-sm overflow-y-auto bg-white dark:bg-slate-900/40"
          style={{ minHeight: `${rows * 1.6}rem` }}
        >
          {value.trim() === '' ? (
            <p className="text-gray-400 dark:text-slate-500 italic">{placeholder || rt.emptyPreview}</p>
          ) : contentIsHtml ? (
            <div className="rte-html-preview text-gray-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
          ) : (
            <MarkdownContent content={value} />
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          required={required}
          rows={rows}
          value={value}
          onChange={(e) => {
            lastEmittedRef.current = e.target.value;
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 text-sm border-none focus:outline-none resize-y dark:bg-slate-900/40 dark:text-white dark:placeholder-slate-500"
        />
      )}

      <style jsx>{`
        .rte-html-preview :global(h2) {
          font-size: 1.15rem;
          font-weight: 800;
          margin: 1.5rem 0 0.6rem;
        }
        .rte-html-preview :global(h2:first-child) {
          margin-top: 0;
        }
        .rte-html-preview :global(h3) {
          font-size: 1.02rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
        }
        .rte-html-preview :global(p) {
          margin: 0 0 0.9rem;
          line-height: 1.7;
        }
        .rte-html-preview :global(ul),
        .rte-html-preview :global(ol) {
          margin: 0 0 0.9rem;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .rte-html-preview :global(ul) {
          list-style: disc;
        }
        .rte-html-preview :global(ol) {
          list-style: decimal;
        }
        .rte-html-preview :global(strong) {
          font-weight: 700;
        }
        .rte-html-preview :global(blockquote) {
          border-left: 3px solid rgba(6, 182, 212, 0.5);
          padding: 0.25rem 0 0.25rem 1rem;
          margin: 1.1rem 0;
          font-style: italic;
          opacity: 0.85;
        }
        .rte-html-preview :global(a) {
          color: #0891b2;
          text-decoration: underline;
        }
        .rte-html-preview :global(img) {
          max-width: 100%;
          border-radius: 0.6rem;
          margin: 0.9rem 0;
        }
        .rte-html-preview :global(code) {
          background: rgba(148, 163, 184, 0.2);
          padding: 0.15rem 0.35rem;
          border-radius: 0.3rem;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}
