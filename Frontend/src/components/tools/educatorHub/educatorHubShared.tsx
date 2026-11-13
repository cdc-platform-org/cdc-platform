/**
 * Shared pieces of the Educator Hub: tab ids and labels, DOCX/TXT/print
 * export (ExportBar), the usage meter, error-message extraction and the
 * form field class names used by every module.
 */
import { useState } from 'react';
import { FileText, ClipboardList, PenSquare, Puzzle, BookOpen, FolderKanban, Mail, Crown, Copy, Printer, FileDown } from 'lucide-react';

export type TabId = 'test' | 'rubric' | 'grading' | 'sen' | 'lessonPlan' | 'bureaucracy' | 'parentReports' | 'certificates';

// All 7 modules are real generation now — no more "coming soon" tier.
export const REAL_TABS: { id: TabId; icon: typeof FileText }[] = [
  { id: 'test', icon: FileText },
  { id: 'rubric', icon: ClipboardList },
  { id: 'grading', icon: PenSquare },
  { id: 'sen', icon: Puzzle },
  { id: 'lessonPlan', icon: BookOpen },
  { id: 'bureaucracy', icon: FolderKanban },
  { id: 'parentReports', icon: Mail },
  { id: 'certificates', icon: Crown }, // New tab for certificates
];

export const TAB_LABEL_KEY: Record<TabId, { key: string; fallback: string }> = {
  test: { key: 'tabTestGenerator', fallback: 'ტესტები' },
  rubric: { key: 'tabRubric', fallback: 'რუბრიკები' },
  grading: { key: 'tabGrading', fallback: 'დავალებების გასწორება' },
  sen: { key: 'tabSen', fallback: 'დიფერენცირება & სსსმ' },
  lessonPlan: { key: 'tabLessonPlan', fallback: 'გაკვეთილის გეგმები' },
  bureaucracy: { key: 'tabBureaucracy', fallback: 'დოკუმენტაცია' },
  parentReports: { key: 'tabParentReports', fallback: 'მშობლის რეპორტები' },
  certificates: { key: 'tabCertificates', fallback: 'სერტიფიკატები' },
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportDocx(sections: { heading: string; body: string }[], filename: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const toParagraphs = (text: string) => text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const children: any[] = [];
  sections.forEach(({ heading, body }) => {
    children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 }));
    children.push(...toParagraphs(body));
  });
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

export function exportTxt(sections: { heading: string; body: string }[], filename: string) {
  const text = sections.map(({ heading, body }) => `${heading}\n\n${body}`).join('\n\n---\n\n');
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

// axios deserializes error bodies as expected here (no blob responseType on
// any Educator Hub call) — same shape as this codebase's other AI-route
// error extraction (see media-studio.tsx's own extractErrorMessage).
export function extractErrorMessage(err: any, fallback: string): { message: string; code?: string } {
  const data = err?.response?.data;
  return { message: data?.message ?? fallback, code: data?.code };
}

export function ExportBar({ t, sections, filenameBase, printAreaId }: { t: (k: string) => string; sections: { heading: string; body: string }[]; filenameBase: string; printAreaId: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(sections.map((s) => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handlePrint = () => {
    document.body.setAttribute('data-print-target', printAreaId);
    window.print();
  };
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <Copy className="w-3.5 h-3.5" />
        {copied ? t('exportCopied') : t('exportCopy')}
      </button>
      <button type="button" onClick={() => exportDocx(sections, `${filenameBase}.docx`)} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <FileDown className="w-3.5 h-3.5" />
        {t('exportDocx')}
      </button>
      <button type="button" onClick={() => exportTxt(sections, `${filenameBase}.txt`)} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <FileDown className="w-3.5 h-3.5" />
        {t('exportTxt')}
      </button>
      <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <Printer className="w-3.5 h-3.5" />
        {t('exportPrint')}
      </button>
    </div>
  );
}

export function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
        <span>{label}</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const inputClass =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500';

export const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';

// Native <select> renders its <option> popup via the OS, outside the page's
// own light/dark styling — without an explicit color here, dark mode's
// light-on-dark <select> text can end up illegible (or invisible) against
// the option list's default background in some browsers.
export const optionClass = 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white';
