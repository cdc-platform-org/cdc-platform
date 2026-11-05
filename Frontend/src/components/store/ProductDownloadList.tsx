import { Download, ShieldAlert, X } from 'lucide-react';
import { ProductFile, ProductLicenseType, LICENSE_LABELS } from '../../services/productService';

interface ProductDownloadListProps {
  files: ProductFile[];
  licenseType: ProductLicenseType | null;
  lang: 'ka' | 'en';
  onClose: () => void;
}

const LABELS = {
  ka: { title: 'ჩამოსატვირთი ფაილები', download: 'ჩამოტვირთვა', close: 'დახურვა', file: 'ფაილი' },
  en: { title: 'Your files', download: 'Download', close: 'Close', file: 'File' },
};

// Shown when a purchased product has more than one downloadable file (see
// Backend's products.ts GET /:id/download `files`). Each file is a real
// <a> the buyer clicks themselves — opening several tabs programmatically
// after an await would be popup-blocked for all but the first. The links
// are short-lived, so this list is only kept while open, never cached.
export default function ProductDownloadList({ files, licenseType, lang, onClose }: ProductDownloadListProps) {
  const l = LABELS[lang];
  const license = licenseType ? LICENSE_LABELS[licenseType] : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={l.title}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{l.title}</h2>
          <button type="button" onClick={onClose} aria-label={l.close} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        {license && licenseType === 'PERSONAL_USE' && (
          <div className="mb-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{lang === 'ka' ? license.descriptionKa : license.descriptionEn}</span>
          </div>
        )}
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${i}-${f.url}`} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{f.name || `${l.file} ${i + 1}`}</span>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white no-underline hover:bg-emerald-700"
              >
                <Download className="w-3.5 h-3.5" /> {l.download}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
