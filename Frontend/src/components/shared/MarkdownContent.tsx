import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

// Shared renderer for Markdown-sourced description/body fields (course,
// digital product, etc. — see RichTextEditor, which writes this syntax).
// react-markdown escapes everything by default, so this never needs
// dangerouslySetInnerHTML or an HTML-sanitizer dependency — raw HTML typed
// into the source textarea renders as literal text, not markup.
const components: Components = {
  p: (props) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-bold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  h1: (props) => <h2 className="text-lg font-black mt-5 mb-2" {...props} />,
  h2: (props) => <h2 className="text-lg font-black mt-5 mb-2" {...props} />,
  h3: (props) => <h3 className="text-base font-bold mt-4 mb-2" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => <a className="underline text-cyan-600 dark:text-cyan-400" target="_blank" rel="noopener noreferrer" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-slate-200 dark:border-slate-700 pl-4 italic text-slate-500 dark:text-slate-400 my-3" {...props} />
  ),
  hr: () => <hr className="my-4 border-slate-200 dark:border-slate-700" />,
};

export default function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`text-sm text-slate-600 dark:text-slate-300 ${className}`}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
