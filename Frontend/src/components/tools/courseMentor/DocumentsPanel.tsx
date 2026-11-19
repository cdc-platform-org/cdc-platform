/**
 * Personal Mentor — teaching materials panel: upload files (any supported
 * format), add a link (web page, Google Docs/Drive, YouTube) or paste text;
 * live processing status; delete. The supported formats and limits are shown
 * right here so the teacher knows the rules before uploading. The parent page
 * polls the course while any document is PROCESSING.
 */
import { ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { FileText, Upload, Trash2, Loader2, CheckCircle2, AlertTriangle, Link2, ClipboardPaste, Info, Globe } from 'lucide-react';
import { MentorDocument, uploadDocument, deleteDocument, addLink, addPastedText, apiErrorMessage } from '../../../services/courseMentorService';
import { inputClass } from './CourseForm';

interface Props {
  courseId: string;
  documents: MentorDocument[];
  locked: boolean;
  onChanged: () => void;
}

// Must match Backend sources/fileExtractors.ts SUPPORTED_FILE_EXTENSIONS.
const ACCEPT = '.pdf,.docx,.doc,.rtf,.odt,.pptx,.odp,.xlsx,.ods,.epub,.txt,.md,.csv,.tsv,.json,.html,.htm,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 40 * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const btn = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border cursor-pointer disabled:opacity-60';

export default function DocumentsPanel({ courseId, documents, locked, onChanged }: Props) {
  const { t } = useTranslation('courseMentor');
  const { locale } = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'none' | 'link' | 'text'>('none');
  const [url, setUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);
    // One at a time: books are large and each upload starts a background job.
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: ${t('documents.tooLarge')}`);
        continue;
      }
      setBusy(t('documents.uploading', { name: file.name, pct: 0 }));
      try {
        await uploadDocument(courseId, file, (pct) => setBusy(t('documents.uploading', { name: file.name, pct })));
        onChanged();
      } catch (err) {
        setError(`${file.name}: ${apiErrorMessage(err, t('errors.upload'))}`);
      }
    }
    setBusy(null);
  };

  const submitLink = async () => {
    setError(null);
    setBusy(t('documents.addingLink'));
    try {
      await addLink(courseId, url.trim(), locale);
      setUrl('');
      setMode('none');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
  };

  const submitText = async () => {
    setError(null);
    setBusy(t('documents.addingText'));
    try {
      await addPastedText(courseId, pasteTitle.trim() || t('documents.pastedDefaultTitle'), pasteText);
      setPasteTitle('');
      setPasteText('');
      setMode('none');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(null);
    }
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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-extrabold text-cdc-ink">{t('documents.title')}</h2>
          <p className="text-sm text-cdc-muted">{t('documents.subtitle')}</p>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onFiles} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={locked || !!busy} onClick={() => inputRef.current?.click()} className={`${btn} bg-cdc-primary text-white border-cdc-primary`}>
            <Upload className="w-4 h-4" aria-hidden />{t('documents.upload')}
          </button>
          <button type="button" disabled={locked || !!busy} onClick={() => setMode(mode === 'link' ? 'none' : 'link')} className={`${btn} bg-cdc-bg text-cdc-ink border-cdc-border`}>
            <Link2 className="w-4 h-4" aria-hidden />{t('documents.addLink')}
          </button>
          <button type="button" disabled={locked || !!busy} onClick={() => setMode(mode === 'text' ? 'none' : 'text')} className={`${btn} bg-cdc-bg text-cdc-ink border-cdc-border`}>
            <ClipboardPaste className="w-4 h-4" aria-hidden />{t('documents.pasteText')}
          </button>
        </div>
      </div>

      {/* The rules, visible before uploading. */}
      <div className="rounded-xl bg-cdc-bg border border-cdc-border p-3 mb-4 text-xs text-cdc-muted space-y-1">
        <p className="inline-flex items-center gap-1.5 font-bold text-cdc-ink"><Info className="w-4 h-4" aria-hidden />{t('documents.rulesTitle')}</p>
        <p>{t('documents.rulesFiles')}</p>
        <p>{t('documents.rulesLinks')}</p>
        <p>{t('documents.rulesScans')}</p>
        <p>{t('documents.rulesLimits')}</p>
        <p>{t('documents.rulesNot')}</p>
      </div>

      {mode === 'link' && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input type="url" className={inputClass} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('documents.addLink')} />
          <button type="button" disabled={!/^https?:\/\/\S+/.test(url.trim()) || !!busy} onClick={submitLink} className={`${btn} bg-cdc-primary text-white border-cdc-primary shrink-0`}>
            <Globe className="w-4 h-4" aria-hidden />{t('documents.addLinkSubmit')}
          </button>
        </div>
      )}
      {mode === 'text' && (
        <div className="space-y-2 mb-4">
          <input className={inputClass} placeholder={t('documents.pastedTitlePlaceholder')} value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} aria-label={t('documents.pastedTitlePlaceholder')} />
          <textarea className={inputClass} rows={8} placeholder={t('documents.pastedTextPlaceholder')} value={pasteText} onChange={(e) => setPasteText(e.target.value)} aria-label={t('documents.pasteText')} />
          <button type="button" disabled={pasteText.trim().length < 20 || !!busy} onClick={submitText} className={`${btn} bg-cdc-primary text-white border-cdc-primary`}>
            <ClipboardPaste className="w-4 h-4" aria-hidden />{t('documents.addTextSubmit')}
          </button>
        </div>
      )}

      {busy && <p className="inline-flex items-center gap-2 text-sm text-cdc-muted mb-3"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />{busy}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-red-600 mb-3">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-cdc-muted py-6 text-center">{t('documents.empty')}</p>
      ) : (
        <ul className="divide-y divide-cdc-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              {doc.sourceUrl ? <Globe className="w-5 h-5 shrink-0 text-cdc-muted" aria-hidden /> : <FileText className="w-5 h-5 shrink-0 text-cdc-muted" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cdc-ink truncate">{doc.filename}</p>
                <p className="text-xs text-cdc-muted break-words">
                  {doc.sourceUrl ? doc.sourceUrl : formatSize(doc.sizeBytes)}
                  {doc.status === 'READY' && ` · ${t('documents.sections', { count: doc.chunkCount })}`}
                  {doc.note && ` · ${doc.note}`}
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
