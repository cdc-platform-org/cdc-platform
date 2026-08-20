import { useState, useEffect, useCallback, FormEvent } from 'react';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import { ShieldCheck, ThumbsUp, ImagePlus, X } from 'lucide-react';
import StarRating from '../community/StarRating';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { ProductReview, ProductReviewsSummary } from '../../types/productReview';
import { getProductReviews, createProductReview, toggleReviewHelpful, uploadProductReviewImage } from '../../services/productReviewService';

interface ProductReviewsSectionProps {
  productId: string;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

function ReviewCard({ review, onToggleHelpful }: { review: ProductReview; onToggleHelpful: (id: string) => void }) {
  const { t } = useTranslation('marketplace');
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
            {review.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-900 dark:text-white">{review.user.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full px-2 py-0.5">
                <ShieldCheck className="w-3 h-3" />
                {t('reviewsVerifiedBuyer')}
              </span>
            </div>
            <StarRating value={review.rating} size="sm" />
          </div>
        </div>
        <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed whitespace-pre-wrap">{review.comment}</p>

      {review.images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.images.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 block">
              <Image src={url} alt={`${review.user.name} photo ${i + 1}`} fill className="object-cover" unoptimized />
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleHelpful(review.id)}
        className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
          review.helpfulVoted
            ? 'border-cyan-400 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10'
            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600'
        }`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        {t('reviewsHelpful')} {review.helpfulCount > 0 ? `(${review.helpfulCount})` : ''}
      </button>
    </div>
  );
}

function RatingBreakdownBars({ summary }: { summary: ProductReviewsSummary }) {
  const total = summary.reviewCount || 1;
  return (
    <div className="space-y-1.5 w-full max-w-xs">
      {STAR_LEVELS.map((star) => {
        const count = summary.starBreakdown[star] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-8 shrink-0 text-slate-500 dark:text-slate-400">{star}★</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-slate-400">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const { t } = useTranslation('marketplace');
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [summary, setSummary] = useState<ProductReviewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getProductReviews(productId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleHelpful = async (reviewId: string) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    try {
      const { helpfulCount, helpfulVoted } = await toggleReviewHelpful(reviewId);
      setSummary((prev) =>
        prev
          ? { ...prev, reviews: prev.reviews.map((r) => (r.id === reviewId ? { ...r, helpfulCount, helpfulVoted } : r)) }
          : prev
      );
    } catch {
      // Non-critical action — silently ignore a failed vote toggle.
    }
  };

  const MAX_REVIEW_PHOTOS = 3;

  const handleImageSelect = async (file: File | null) => {
    if (!file || images.length >= MAX_REVIEW_PHOTOS) return;
    setUploadingImage(true);
    setFormError(null);
    try {
      const url = await uploadProductReviewImage(file);
      setImages((prev) => [...prev, url]);
    } catch {
      setFormError(t('reviewsSubmitFailed'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setFormError(t('reviewsSelectRating'));
      return;
    }
    if (comment.trim().length < 10) {
      setFormError(t('reviewsCommentTooShort'));
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await createProductReview({ productId, rating, comment: comment.trim(), images });
      setShowForm(false);
      setRating(0);
      setComment('');
      setImages([]);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? t('reviewsSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !summary) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 mt-6">
      <h2 className="text-sm font-black tracking-wide mb-5">{t('reviewsTitle')}</h2>

      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
        <div className="flex flex-col items-center sm:items-start gap-1 shrink-0">
          <span className="text-4xl font-black">{summary.averageRating !== null ? summary.averageRating.toFixed(1) : '—'}</span>
          {summary.averageRating !== null ? (
            <>
              <StarRating value={summary.averageRating} size="sm" />
              <span className="text-xs text-slate-400">
                {t('reviewsBasedOn', { count: summary.reviewCount })}
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400">{t('reviewsNoRatingYet')}</span>
          )}
        </div>
        {summary.reviewCount > 0 && <RatingBreakdownBars summary={summary} />}
      </div>

      {summary.myReview ? (
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">{t('reviewsYourReview')}</p>
          <ReviewCard review={summary.myReview} onToggleHelpful={handleToggleHelpful} />
        </div>
      ) : summary.canReview ? (
        !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mb-6 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-5 py-2.5 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {t('reviewsWriteReview')}
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            {formError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{formError}</div>
            )}
            <div className="flex flex-col items-center gap-2">
              <StarRating value={rating} onChange={setRating} size="lg" />
              <span className="text-xs text-slate-400">{rating > 0 ? `${rating} / 5` : t('reviewsRatingLabel')}</span>
            </div>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reviewsCommentPlaceholder')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="flex flex-wrap items-center gap-2">
              {images.map((url) => (
                <div key={url} className="relative w-20 h-20">
                  <Image src={url} alt="" fill className="object-cover rounded-lg border border-slate-200 dark:border-slate-800" unoptimized />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_REVIEW_PHOTOS && (
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-cyan-600">
                  <ImagePlus className="w-4 h-4" />
                  {uploadingImage ? t('processing') : t('reviewsAddPhoto')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                {t('reviewsCancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingImage}
                className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {submitting ? t('reviewsSubmitting') : t('reviewsSubmit')}
              </button>
            </div>
          </form>
        )
      ) : null}

      {summary.reviews.length === 0 ? (
        <p className="text-sm text-slate-400">{t('reviewsEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {summary.reviews
            .filter((r) => !summary.myReview || r.id !== summary.myReview.id)
            .map((review) => (
              <ReviewCard key={review.id} review={review} onToggleHelpful={handleToggleHelpful} />
            ))}
        </div>
      )}
    </div>
  );
}
