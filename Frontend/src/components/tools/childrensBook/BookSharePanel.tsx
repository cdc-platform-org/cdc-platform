import { useState } from 'react';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { BookLanguage, bookShareUrl, setBookSharing } from '../../../services/childrensBookService';

// The parent's switch for the public "read & listen" link of a finished
// book. The same link is the QR code on the PDF's back cover, so switching
// it rebuilds the PDF (a few seconds) and turning it back on makes a new
// link: anything printed or forwarded before stays closed.

export default function BookSharePanel({ bookId, language, token, disabled, onChanged }: {
  bookId: string;
  language: BookLanguage;
  token: string | null;
  disabled: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation('childrensBook');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = !!token && !disabled;
  const url = token ? bookShareUrl(token, language) : '';

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setBookSharing(bookId, !enabled);
      onChanged();
    } catch {
      setError(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is visible and selectable */
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-gray-800"><Link2 className="h-4 w-4 text-purple-600" /> {t('shareTitle')}</div>
        <button
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? 'bg-purple-600' : 'bg-gray-300'} disabled:opacity-50`}
          aria-label={t('shareTitle')}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-600">{enabled ? t('shareHintOn') : t('shareHintOff')}</p>
      {busy && <p className="mt-2 flex items-center gap-1.5 text-sm text-purple-700"><Loader2 className="h-4 w-4 animate-spin" />{t('shareUpdating')}</p>}
      {enabled && !busy && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700" aria-label={t('shareTitle')} />
          <button onClick={copy} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t('shareCopied') : t('shareCopy')}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
