import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Clapperboard, Download, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import PromoCodeField from '../../shared/PromoCodeField';
import type { PromoValidationResult } from '../../../services/paymentService';
import {
  BookAnimationStatus,
  SharedBookAnimation,
  buyBookAnimation,
  getBookAnimation,
  getSharedBookAnimation,
  retryBookAnimation,
  simulateBookAnimationPayment,
} from '../../../services/bookAnimationService';

// "Make it an animated video" add-on of a finished book (owner view on the
// book page). Buy -> progress -> player + download. Polls while rendering.

const POLL_MS = 6000;

function formatGel(tetri: number): string {
  const gel = tetri / 100;
  return Number.isInteger(gel) ? String(gel) : gel.toFixed(2);
}

function VideoPlayer({ src, title }: { src: string; title: string }) {
  return (
    // No caption track: the page text is burned into the video as subtitles.
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-lg bg-black shadow-sm"
      aria-label={title}
    />
  );
}

export default function AnimationCard({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const { t } = useTranslation('bookAnimation');
  const router = useRouter();
  const lang: 'ka' | 'en' = router.locale === 'ka' ? 'ka' : 'en';
  const [status, setStatus] = useState<BookAnimationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState<PromoValidationResult | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getBookAnimation(bookId));
    } catch {
      /* the card simply stays in its last state */
    }
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);

  const state = status?.animation?.status ?? null;
  const working = state === 'QUEUED' || state === 'RENDERING';
  // Right after returning from the payment page the BOG callback may still be on its way.
  const awaitingPayment = state === 'PAYMENT_PENDING' && router.query.animation === 'paid';

  useEffect(() => {
    if (!working && !awaitingPayment) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [working, awaitingPayment, load]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('error'));
    } finally {
      setBusy(false);
    }
  }

  const buy = () =>
    act(async () => {
      const result = await buyBookAnimation(bookId, { promoCode: promo?.code, lang });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      await load();
    });

  if (!status || !status.eligible) return null;
  const price = formatGel(promo ? promo.discountedAmount : status.priceTetri);

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-white p-4" data-testid="book-animation-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white"><Clapperboard className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-800">{state === 'READY' ? t('readyTitle') : t('title', { price: formatGel(status.priceTetri) })}</h3>
          {(state === null || state === 'PAYMENT_PENDING') && <p className="mt-1 text-sm text-gray-600">{t('description')}</p>}
        </div>
      </div>

      {(state === null || state === 'PAYMENT_PENDING') && (
        <div className="mt-3">
          <ul className="mb-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
            <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" />{t('featureMotion')}</li>
            <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" />{t('featureNarration')}</li>
            <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" />{t('featureMusic')}</li>
            <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" />{t('featureDownload')}</li>
          </ul>
          {awaitingPayment ? (
            <p className="flex items-center gap-1.5 text-sm text-purple-700"><Loader2 className="h-4 w-4 animate-spin" />{t('confirmingPayment')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={buy}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                data-testid="book-animation-buy"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                {t('buyButton', { price })}
              </button>
              {state === 'PAYMENT_PENDING' && status.devPaymentSimulation && (
                <button
                  onClick={() => act(async () => setStatus(await simulateBookAnimationPayment(bookId)))}
                  disabled={busy}
                  className="rounded-lg border border-purple-300 px-4 py-2 text-sm text-purple-700 disabled:opacity-50"
                >
                  {t('devSimulate')}
                </button>
              )}
              <div className="basis-full">
                <PromoCodeField targetType={status.promoTargetType} targetId={status.promoTargetId} lang={lang} applied={promo} onChange={setPromo} disabled={busy} />
              </div>
            </div>
          )}
        </div>
      )}

      {working && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-medium text-purple-800"><Loader2 className="h-4 w-4 animate-spin" />{state === 'QUEUED' ? t('queued') : t('rendering')}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100">
            <div className="h-full w-1/3 animate-[book-animation-progress_1.8s_ease-in-out_infinite] rounded-full bg-purple-500" />
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('renderingHint')}</p>
          <style jsx global>{`
            @keyframes book-animation-progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(300%); }
            }
          `}</style>
        </div>
      )}

      {state === 'READY' && status.animation?.videoUrl && (
        <div className="mt-3">
          <VideoPlayer src={status.animation.videoUrl} title={t('videoLabel', { title: bookTitle })} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {status.animation.downloadUrl && (
              <a href={status.animation.downloadUrl} className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-purple-800" data-testid="book-animation-download">
                <Download className="h-4 w-4" />{t('download')}
              </a>
            )}
            <p className="text-xs text-gray-500">{t('shareHint')}</p>
          </div>
        </div>
      )}

      {state === 'FAILED' && (
        <div className="mt-3">
          <p className="text-sm text-red-700">{t('failed')}</p>
          {status.animation?.paid && (
            <button
              onClick={() => act(async () => setStatus(await retryBookAnimation(bookId)))}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />{t('retry')}
            </button>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

// Public share page (/book/<token>): the finished video, small, below the book.
export function SharedAnimation({ token }: { token: string }) {
  const { t } = useTranslation('bookAnimation');
  const [video, setVideo] = useState<SharedBookAnimation | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSharedBookAnimation(token)
      .then((data) => { if (!cancelled) setVideo(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  if (!video?.videoUrl) return null;
  return (
    <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-purple-100 bg-white p-4 shadow-sm" data-testid="shared-book-animation">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800"><Clapperboard className="h-5 w-5 text-purple-600" />{t('sharedTitle')}</h2>
      <VideoPlayer src={video.videoUrl} title={t('sharedTitle')} />
      {video.downloadUrl && (
        <a href={video.downloadUrl} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-purple-700 hover:underline">
          <Download className="h-4 w-4" />{t('download')}
        </a>
      )}
    </section>
  );
}
