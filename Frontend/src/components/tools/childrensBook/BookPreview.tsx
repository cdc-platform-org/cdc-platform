import { useTranslation } from 'next-i18next';
import { BookOpen, CheckCircle2, Eye, Loader2, Lock, Users, Palette } from 'lucide-react';
import { BookProject } from '../../../services/childrensBookService';

interface BookPreviewProps {
  book: BookProject;
  portraitUrl: string | null;
  busy: boolean;
  // Null when the preview was already confirmed and is only being re-viewed.
  onConfirm: (() => void) | null;
  onClose?: () => void;
}

type PlanPage = { pageNumber: number; storyText: string };

// Full book preview shown after the character is approved and before
// payment: cover, approved portrait, every page's story text in reading
// order, and what the buyer is about to pay for. Illustrations are painted
// only after payment, so each page shows the approved portrait as a stand-in
// and says so plainly.
export default function BookPreview({ book, portraitUrl, busy, onConfirm, onClose }: BookPreviewProps) {
  const { t } = useTranslation('childrensBook');
  const pages = ((book.storyPlan?.pages ?? []) as PlanPage[]).slice().sort((a, b) => a.pageNumber - b.pageNumber);
  const config = book.characterConfig;
  const dedication = book.storyPlan?.dedication ?? config?.dedication ?? null;
  const total = (book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel) / 100;

  return (
    <section aria-labelledby="book-preview-title">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 id="book-preview-title" className="font-semibold text-gray-800 flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-600" /> {t('previewTitle')}
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-sm text-purple-600 font-medium hover:underline">{t('previewClose')}</button>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-5">{t('previewIntro')}</p>

      {/* Cover */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 border border-purple-200 p-5 sm:p-6 mb-5 flex flex-col sm:flex-row items-center gap-5">
        {portraitUrl ? (
          <img src={portraitUrl} alt={config?.name || ''} className="w-40 h-40 object-contain rounded-xl bg-white/70 border border-white shadow-sm" />
        ) : (
          <div className="w-40 h-40 rounded-xl bg-white/70 border border-white flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-purple-300" />
          </div>
        )}
        <div className="text-center sm:text-left min-w-0">
          <div className="text-xs uppercase tracking-wide text-purple-600 font-semibold mb-1">{t('previewCoverLabel')}</div>
          <h3 className="text-2xl font-bold text-gray-900 break-words">{book.title}</h3>
          <p className="text-gray-700 mt-1">{t('previewStarring', { name: config?.name ?? '' })}</p>
          {dedication && <p className="text-sm italic text-gray-600 mt-3">“{dedication}”</p>}
        </div>
      </div>

      {/* What the parent asked for */}
      {(config?.appearance || config?.extraCharacters || config?.photoKey) && (
        <dl className="grid gap-3 sm:grid-cols-2 mb-5 text-sm">
          {config?.appearance && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <dt className="flex items-center gap-1 font-medium text-gray-800"><Palette className="w-4 h-4 text-purple-600" /> {t('appearanceLabel')}</dt>
              <dd className="text-gray-600 mt-1 break-words">{config.appearance}</dd>
            </div>
          )}
          {config?.extraCharacters && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <dt className="flex items-center gap-1 font-medium text-gray-800"><Users className="w-4 h-4 text-purple-600" /> {t('extraCharactersLabel')}</dt>
              <dd className="text-gray-600 mt-1 break-words">{config.extraCharacters}</dd>
            </div>
          )}
          {config?.photoKey && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2 text-gray-600">{t('previewPhotoUsed')}</div>
          )}
        </dl>
      )}

      {/* Pages */}
      <ol className="grid gap-3 sm:grid-cols-2 mb-5">
        {pages.map((page) => (
          <li key={page.pageNumber} className="rounded-xl border border-gray-200 bg-white overflow-hidden flex">
            <div className="relative w-24 shrink-0 bg-purple-50 flex items-center justify-center">
              {portraitUrl ? (
                <img src={portraitUrl} alt="" className="w-full h-full object-cover opacity-60" />
              ) : (
                <BookOpen className="w-6 h-6 text-purple-300" />
              )}
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-white/90 px-1 py-0.5 text-[10px] text-gray-600">
                <Lock className="w-3 h-3" /> {t('previewIllustrationLocked')}
              </span>
            </div>
            <div className="p-3 min-w-0">
              <div className="text-xs font-semibold text-purple-700 mb-1">{t('pageLabel', { number: page.pageNumber })}</div>
              <p className="text-sm text-gray-700 break-words">{page.storyText}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-gray-700 mb-4">
        <p className="font-medium text-gray-800 mb-1">{t('previewIncludesTitle')}</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>{t('previewIncludesPages', { count: book.pageCount })}</li>
          <li>{t('previewIncludesPdf')}</li>
          <li>{t('previewIncludesRevision')}</li>
          {book.audioAddOnPurchased && <li>{t('previewIncludesAudio')}</li>}
        </ul>
        <p className="mt-2 font-semibold text-gray-900">{t('previewTotal', { amount: total })}</p>
      </div>

      {onConfirm && (
        <>
          <p className="text-xs text-gray-500 mb-3">{t('previewConfirmHint')}</p>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t('previewConfirmButton')}
          </button>
        </>
      )}
    </section>
  );
}
