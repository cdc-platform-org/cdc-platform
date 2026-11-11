// Small, dependency-free Markdown <-> HTML bridge for the job-post WYSIWYG
// editor (src/components/shared/WysiwygEditor.tsx).
//
// Storage stays Markdown (`**bold**`, `_italic_`, `## heading`, `- item`,
// `1. item`) so every existing gig/vacancy description, the backend's
// length/min-length validation and MarkdownContent (react-markdown) keep
// working unchanged. The editor only needs HTML while the user is typing:
//   markdown --markdownToHtml--> contentEditable --htmlToMarkdown--> markdown
//
// Only the subset the toolbar can produce is supported. Everything else is
// escaped text, so markdownToHtml's output is safe to place in innerHTML
// (the editor additionally runs it through DOMPurify).

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same normalisation MarkdownContent applies — some legacy rows contain
// literal "\n" escape sequences instead of real newlines.
const normalizeNewlines = (raw: string) => raw.replace(/\r\n/g, '\n').replace(/\\r\\n|\\n/g, '\n');

function inlineToHtml(text: string): string {
  let out = escapeHtml(text);
  // Bold first (** / __), then italic (* / _). Non-greedy, single line.
  out = out.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
  return out;
}

export function markdownToHtml(markdown: string): string {
  const lines = normalizeNewlines(markdown ?? '').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inlineToHtml).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map((i) => `<li>${inlineToHtml(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (line.trim() === '') {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      html.push(`<h2>${inlineToHtml(heading[2])}</h2>`);
    } else if (bullet || ordered) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return html.join('');
}

// ---------- HTML (contentEditable DOM) -> Markdown ----------

function wrapInline(marker: string, inner: string): string {
  if (!inner.trim()) return inner;
  // Markers must hug non-space characters to be valid Markdown emphasis.
  const lead = inner.match(/^\s*/)![0];
  const trail = inner.match(/\s*$/)![0];
  return `${lead}${marker}${inner.trim()}${marker}${trail}`;
}

function inlineMd(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(/ /g, ' ');
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = () => Array.from(el.childNodes).map(inlineMd).join('');
  if (tag === 'br') return '\n';
  const weight = el.style?.fontWeight;
  if (tag === 'strong' || tag === 'b' || weight === 'bold' || Number(weight) >= 600) return wrapInline('**', children());
  if (tag === 'em' || tag === 'i' || el.style?.fontStyle === 'italic') return wrapInline('_', children());
  if (BLOCK_TAGS.has(tag)) return `\n${children()}\n`;
  return children();
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote']);

function blockMd(el: Element, out: string[]) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    let i = 1;
    const items: string[] = [];
    el.querySelectorAll(':scope > li').forEach((li) => {
      const text = inlineMd(li).replace(/\n+/g, ' ').trim();
      if (text) items.push(`${tag === 'ol' ? `${i++}.` : '-'} ${text}`);
    });
    if (items.length) out.push(items.join('\n'));
    return;
  }
  if (/^h[1-6]$/.test(tag)) {
    const text = inlineMd(el).replace(/\n+/g, ' ').trim();
    if (text) out.push(`## ${text}`);
    return;
  }
  // A div/p may itself contain block children (browsers nest when pasting).
  const hasBlockChild = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
  if (hasBlockChild) {
    collectBlocks(el, out);
    return;
  }
  const text = inlineMd(el)
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
  if (text) out.push(text);
}

function collectBlocks(root: Node, out: string[]) {
  let inlineBuffer = '';
  const flushInline = () => {
    const text = inlineBuffer.trim();
    if (text) out.push(text);
    inlineBuffer = '';
  };
  root.childNodes.forEach((child) => {
    if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName.toLowerCase())) {
      flushInline();
      blockMd(child as Element, out);
    } else {
      inlineBuffer += inlineMd(child);
    }
  });
  flushInline();
}

export function htmlElementToMarkdown(root: HTMLElement): string {
  const out: string[] = [];
  collectBlocks(root, out);
  return out
    .join('\n\n')
    .replace(/\*\*\*\*/g, '') // adjacent bold runs: "**a****b**" -> "**ab**"
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') return stripMarkdown(html);
  // DOMParser builds an inert document: no script execution, no image
  // loads / onerror handlers — unlike innerHTML on a live-document element.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return htmlElementToMarkdown(doc.body);
}

// ---------- Plain-text excerpt for cards / meta descriptions ----------

export function stripMarkdown(markdown: string): string {
  return normalizeNewlines(markdown ?? '')
    .replace(/<[^>]+>/g, ' ') // AI drafts / legacy HTML
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(?=\S)(.*?\S)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|__/g, '') // unmatched leftovers, e.g. a truncated "**გამარ"
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
