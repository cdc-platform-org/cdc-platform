/**
 * AI Course Mentor — source documents panel: upload (PDF/DOCX/MD/TXT), live
 * processing status, delete. The parent page polls the course while any
 * document is PROCESSING and passes fresh rows in.
 */
import { ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { FileText, Upload, Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MentorDocument, uploadDocument, deleteDocument, apiErrorMessage } from '../../../services/courseMentorService';

interface Props {
  courseId: string;
  documents: MentorDocument[];
  locked: boolean;
  onChanged: () => void;
}

const ACCEPT = '.pdf,.docx,.md,.txt';

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DocumentsPanel({ courseId, documents, locked, onChanged }: Props) {
  const { t } = useTranslation('courseMentor');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);
    // One at a time: books are large and each upload starts a background job.
    for (const file of files) {
      setUploading({ name: file.name, pct: 0 });
      try {
        await uploadDocument(courseId, file, (pct) => setUploading({ name: file.name, pct }));
        onChanged();
      } catch (err) {
        setError(`${file.name}: ${apiErrorMessage(err, t('errors.upload'))}`);
      }
    }
    setUploading(null);
  };

  const remove = async (doc: MentorDocument) => {
    if (!window.confirm(t('documents.confirmDelete', { name: doc.filename }))) return;
    try {
      await deleteDocument(courseId, doc.id);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    }
  };

  return (
    <section className="rounded-2xl border border-cdc-border bg-cdc-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-cdc-ink">{t('documents.title')}</h2>
          <p className="text-sm text-cdc-muted">{t('documents.subtitle')}</p>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onFiles} />
        <button type="button" disabled={locked || !!uploading} onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-cdc-primary px-4 py-2.5 text-sm font-bold text-white border-none cursor-pointer disabled:opacity-60">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}
          {t('documents.upload')}
        </button>
      </div>

      {uploading && (
        <p className="text-sm text-cdc-muted mb-3">{t('documents.uploading', { name: uploading.name, pct: uploading.pct })}</p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-600 mb-3">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-cdc-muted py-6 text-center">{t('documents.empty')}</p>
      ) : (
        <ul className="divide-y divide-cdc-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              <FileText className="w-5 h-5 shrink-0 text-cdc-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cdc-ink truncate">{doc.filename}</p>
                <p className="text-xs text-cdc-muted">
                  {formatSize(doc.sizeBytes)}
                  {doc.status === 'READY' && ` · ${t('documents.sections', { count: doc.chunkCount })}`}
                  {doc.status === 'FAILED' && doc.error && ` · ${doc.error}`}
                </p>
              </div>
              {doc.status === 'PROCESSING' && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />{t('documents.processing')}</span>
              )}
              {doc.status === 'READY' && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden />{t('documents.ready')}</span>
              )}
              {doc.status === 'FAILED' && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle className="w-3.5 h-3.5" aria-hidden />{t('documents.failed')}</span>
              )}
              <button type="button" disabled={locked} onClick={() => remove(doc)} aria-label={t('documents.delete')}
                className="p-2 rounded-lg text-cdc-muted hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-40">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
