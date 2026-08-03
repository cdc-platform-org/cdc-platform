import { useRef, useState, useLayoutEffect } from 'react';
import { Bold, Italic, Heading2, List, ListOrdered, Smile } from 'lucide-react';

// Lightweight Markdown-source editor — no Tiptap/Quill dependency (this repo's
// npm workspace can't currently take new packages locally, see apiClient.ts's
// history). Toolbar buttons write Markdown syntax directly into a plain
// <textarea>; pair with <MarkdownContent> to render the result. Drop-in
// replacement for a controlled <textarea value/onChange>.

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

export default function RichTextEditor({ value, onChange, placeholder, rows = 6, required, className = '' }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

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
    'inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 bg-transparent border-none cursor-pointer';

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-50 border-b border-gray-200 relative">
        <button type="button" title="Bold" onClick={() => wrapSelection('**')} className={toolbarButtonClass}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Italic" onClick={() => wrapSelection('_')} className={toolbarButtonClass}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Heading" onClick={() => prefixLines('## ')} className={toolbarButtonClass}>
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Bullet list" onClick={() => prefixLines('- ')} className={toolbarButtonClass}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)} className={toolbarButtonClass}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button type="button" title="Emoji" onClick={() => setEmojiOpen((open) => !open)} className={toolbarButtonClass}>
            <Smile className="w-3.5 h-3.5" />
          </button>
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 grid grid-cols-6 gap-0.5 p-2 bg-white border border-gray-200 rounded-lg shadow-lg w-52">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertAtCursor(emoji);
                      setEmojiOpen(false);
                    }}
                    className="text-base p-1 rounded hover:bg-gray-100 bg-transparent border-none cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        required={required}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 text-sm border-none focus:outline-none resize-y"
      />
    </div>
  );
}
