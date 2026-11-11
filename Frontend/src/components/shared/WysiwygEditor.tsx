import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Heading2, List, ListOrdered, Smile } from 'lucide-react';
import { markdownToHtml, htmlElementToMarkdown } from '../../utils/markdownLite';

// WYSIWYG editor for job-post descriptions. Selecting text and pressing Bold
// (or Ctrl/⌘+B) formats it in place — no "**" markers are ever visible.
//
// Storage format is unchanged: the editor takes and emits Markdown (see
// utils/markdownLite.ts), so existing descriptions load correctly and the
// backend's validation/length limits see the same kind of string as before.
// No new npm dependency: contentEditable + document.execCommand, which every
// supported browser still implements for exactly this use case.

const EMOJI = [
  '😀', '😄', '😊', '😉', '😍', '🤔', '😎', '🙌', '👍', '👏',
  '🔥', '✨', '🎉', '🚀', '💡', '⭐', '✅', '❗', '📌', '📈',
  '💻', '🎨', '📷', '🎓', '💼', '🕒', '📍', '💰', '🤝', '❤️',
];

const SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'ul', 'ol', 'li', 'div'],
  ALLOWED_ATTR: [] as string[],
};

export interface WysiwygEditorLabels {
  bold: string;
  italic: string;
  heading: string;
  bulletList: string;
  numberedList: string;
  emoji: string;
}

const DEFAULT_LABELS: WysiwygEditorLabels = {
  bold: 'Bold',
  italic: 'Italic',
  heading: 'Heading',
  bulletList: 'Bullet list',
  numberedList: 'Numbered list',
  emoji: 'Emoji',
};

interface WysiwygEditorProps {
  value: string; // Markdown
  onChange: (markdown: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  labels?: Partial<WysiwygEditorLabels>;
  id?: string;
  ariaLabel?: string;
}

type Command = 'bold' | 'italic' | 'heading' | 'insertUnorderedList' | 'insertOrderedList';

export default function WysiwygEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  className = '',
  labels,
  id,
  ariaLabel,
}: WysiwygEditorProps) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<Command, boolean>>({
    bold: false,
    italic: false,
    heading: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });
  const [isEmpty, setIsEmpty] = useState(!value?.trim());
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Load external values (initial value, form reset, switching post type).
  // Values this editor emitted itself are skipped so typing never resets
  // the caret.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastEmittedRef.current) return;
    el.innerHTML = DOMPurify.sanitize(markdownToHtml(value ?? ''), SANITIZE);
    lastEmittedRef.current = value;
    setIsEmpty(!value?.trim());
  }, [value]);

  const refreshActive = useCallback(() => {
    if (typeof document === 'undefined') return;
    const sel = document.getSelection();
    const el = editorRef.current;
    if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    let block: string = '';
    try {
      block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch {
      block = '';
    }
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      heading: block === 'h2',
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
    savedRangeRef.current = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, [refreshActive]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = htmlElementToMarkdown(el);
    lastEmittedRef.current = md;
    setIsEmpty(md.trim() === '');
    onChange(md);
  }, [onChange]);

  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = savedRangeRef.current;
    const sel = document.getSelection();
    if (range && sel && el.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const run = (cmd: Command) => {
    restoreSelection();
    if (cmd === 'heading') {
      document.execCommand('formatBlock', false, active.heading ? 'p' : 'h2');
    } else {
      document.execCommand(cmd, false);
    }
    emit();
    refreshActive();
  };

  const insertText = (text: string) => {
    restoreSelection();
    document.execCommand('insertText', false, text);
    emit();
  };

  const btn = (isActive: boolean) =>
    `inline-flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer transition-colors ${
      isActive
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
    }`;

  // onMouseDown preventDefault keeps the text selection while clicking the
  // toolbar — otherwise the editor blurs and Bold would have nothing to act on.
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  const tools: { cmd: Command; label: string; Icon: typeof Bold }[] = [
    { cmd: 'bold', label: l.bold, Icon: Bold },
    { cmd: 'italic', label: l.italic, Icon: Italic },
    { cmd: 'heading', label: l.heading, Icon: Heading2 },
    { cmd: 'insertUnorderedList', label: l.bulletList, Icon: List },
    { cmd: 'insertOrderedList', label: l.numberedList, Icon: ListOrdered },
  ];

  return (
    <div
      className={`rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition ${className}`}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 rounded-t-xl relative"
      >
        {tools.map(({ cmd, label, Icon }) => (
          <button
            key={cmd}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active[cmd]}
            data-cmd={cmd}
            onMouseDown={keepSelection}
            onClick={() => run(cmd)}
            className={btn(active[cmd])}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden="true" />
        <div className="relative">
          <button
            type="button"
            title={l.emoji}
            aria-label={l.emoji}
            aria-expanded={emojiOpen}
            onMouseDown={keepSelection}
            onClick={() => setEmojiOpen((o) => !o)}
            className={btn(false)}
          >
            <Smile className="w-4 h-4" />
          </button>
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 grid grid-cols-6 gap-0.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-52">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={keepSelection}
                    onClick={() => {
                      insertText(emoji);
                      setEmojiOpen(false);
                    }}
                    className="text-base p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent border-none cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-slate-400 dark:text-slate-500 select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel ?? placeholder}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onPaste={(e) => {
            // Paste as plain text — keeps foreign markup (fonts, colors,
            // scripts) out of the editor and out of stored descriptions.
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            emit();
          }}
          className="wysiwyg-body w-full px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto break-words"
          style={{ minHeight: `${rows * 1.6}rem`, maxHeight: '28rem' }}
        />
      </div>

      <style jsx>{`
        .wysiwyg-body :global(p),
        .wysiwyg-body :global(div) {
          margin: 0 0 0.5rem;
        }
        .wysiwyg-body :global(h2) {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0.75rem 0 0.4rem;
        }
        .wysiwyg-body :global(ul),
        .wysiwyg-body :global(ol) {
          margin: 0 0 0.5rem;
          padding-left: 1.25rem;
        }
        .wysiwyg-body :global(ul) {
          list-style: disc;
        }
        .wysiwyg-body :global(ol) {
          list-style: decimal;
        }
        .wysiwyg-body :global(strong),
        .wysiwyg-body :global(b) {
          font-weight: 700;
        }
        .wysiwyg-body :global(em),
        .wysiwyg-body :global(i) {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
