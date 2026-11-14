/**
 * One generated coloring page in the gallery: thumbnail (fetched as an
 * authenticated blob — the image route needs the user's session), PDF/PNG
 * download and delete. Used by pages/dashboard/tools/coloring-pages.tsx.
 */
import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import { ColoringPageItem, deleteColoringPage, fetchColoringPageBlob, pngToA4Pdf } from '@/src/services/coloringPagesService';
import type { ColoringStrings } from './strings';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileBase(topic: string) {
  return `coloring-${topic.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page'}`;
}

export default function ColoringPageCard({ page, t, onDeleted }: { page: ColoringPageItem; t: ColoringStrings; onDeleted: (id: string) => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchColoringPageBlob(page.id)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [page.id]);

  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-sm flex flex-col">
      <div className="aspect-[2/3] rounded-xl bg-white border border-slate-100 dark:border-slate-800 overflow-hidden flex items-center justify-center">
        {url ? <img src={url} alt={page.topic} className="w-full h-full object-contain" /> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2" title={page.topic}>{page.topic}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={btn}
          disabled={!blob || busy}
          onClick={async () => {
            if (!blob) return;
            setBusy(true);
            try {
              saveBlob(await pngToA4Pdf(blob), `${fileBase(page.topic)}.pdf`);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FileText className="w-3.5 h-3.5" /> {t.downloadPdf}
        </button>
        <button type="button" className={btn} disabled={!blob} onClick={() => blob && saveBlob(blob, `${fileBase(page.topic)}.png`)}>
          <Download className="w-3.5 h-3.5" /> {t.downloadPng}
        </button>
        <button
          type="button"
          className={`${btn} text-red-600 dark:text-red-400`}
          aria-label={t.delete}
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(t.confirmDelete)) return;
            setBusy(true);
            try {
              await deleteColoringPage(page.id);
              onDeleted(page.id);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
