import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { getLearningRatings, LearningRatings, RatingTarget, saveLearningRating } from '../../services/learningRatingService';
import StarRating from '../community/StarRating';
import LearningRatingSummary from './LearningRatingSummary';

const copy = {
  ka: {
    title: 'შეფასებები', rating: 'შეფასება', comment: 'კომენტარი (არასავალდებულო)',
    save: 'შეფასების შენახვა', saving: 'ინახება…', saved: 'შეფასება შენახულია.',
    edit: 'თქვენი შეფასების რედაქტირება', empty: 'შეფასებები ჯერ არ არის.',
    signIn: 'შეფასებისთვის შედით ანგარიშში', enrolled: 'შეფასება შეუძლიათ მხოლოდ ჩარიცხულ მონაწილეებს.',
    error: 'შეფასებების ჩატვირთვა ვერ მოხერხდა.', retry: 'ხელახლა ცდა',
    select: 'აირჩიეთ 1-დან 5-მდე ვარსკვლავი.', failed: 'შეფასების შენახვა ვერ მოხერხდა.', loading: 'იტვირთება…',
  },
  en: {
    title: 'Ratings and reviews', rating: 'Rating', comment: 'Comment (optional)',
    save: 'Save review', saving: 'Saving…', saved: 'Review saved.',
    edit: 'Edit your review', empty: 'No reviews yet.',
    signIn: 'Sign in to review', enrolled: 'Only enrolled participants can submit a review.',
    error: 'Could not load reviews.', retry: 'Try again',
    select: 'Choose 1 to 5 stars.', failed: 'Could not save your review.', loading: 'Loading…',
  },
};

export default function LearningRatingsSection({ target, targetId, lang, onChange }: {
  target: RatingTarget;
  targetId: string;
  lang: 'ka' | 'en';
  onChange?: (summary: LearningRatings) => void;
}) {
  const t = copy[lang];
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const inputId = useId();
  const [summary, setSummary] = useState<LearningRatings | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await getLearningRatings(target, targetId);
      setSummary(data);
      setRating(data.myReview?.rating ?? 0);
      setComment(data.myReview?.comment ?? '');
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [target, targetId]);

  useEffect(() => { setSummary(null); setSaved(false); setError(null); void load(); }, [load, user?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (rating < 1 || rating > 5) { setError(t.select); return; }
    setSaving(true);
    try {
      await saveLearningRating(target, targetId, rating, comment);
      const data = await getLearningRatings(target, targetId);
      setSummary(data);
      onChange?.(data);
      setSaved(true);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={`${inputId}-title`} className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
      <h2 id={`${inputId}-title`} className="text-xl font-black mb-4">{t.title}</h2>
      {loading ? <p role="status" className="text-sm">{t.loading}</p> : failed ? (
        <div role="status" className="text-sm"><p>{t.error}</p><button type="button" onClick={() => void load()} className="mt-2 underline">{t.retry}</button></div>
      ) : summary && <>
        <LearningRatingSummary {...summary} lang={lang} />
        {isAuthenticated && summary.canReview ? (
          <form onSubmit={submit} className="space-y-4 my-5">
            {summary.myReview && <p className="text-sm font-bold">{t.edit}</p>}
            <fieldset disabled={saving} className="space-y-4">
              <legend className="sr-only">{t.rating}</legend>
              <StarRating value={rating} onChange={setRating} size="lg" label={t.rating} starLabel={(value) => `${value} / 5`} />
              <div>
                <label htmlFor={inputId} className="block text-sm mb-2">{t.comment}</label>
                <textarea id={inputId} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="rounded-lg bg-cyan-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-60">{saving ? t.saving : t.save}</button>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            {saved && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{t.saved}</p>}
          </form>
        ) : <div className="my-4 text-sm text-slate-500 dark:text-slate-400">
          {!isAuthenticated && <button type="button" onClick={() => openAuthModal()} className="underline mb-2">{t.signIn}</button>}
          <p>{t.enrolled}</p>
        </div>}
        {summary.reviewCount === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p> : (
          <ul className="space-y-4 mt-5">
            {summary.reviews.map((review) => <li key={review.id} className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold break-words">{review.user.name}</span>
                <StarRating value={review.rating} size="sm" label={t.rating} />
              </div>
              {review.comment && <p className="mt-2 text-sm whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{review.comment}</p>}
            </li>)}
          </ul>
        )}
      </>}
    </section>
  );
}
