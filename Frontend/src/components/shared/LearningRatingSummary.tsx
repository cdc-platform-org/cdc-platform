import StarRating from '../community/StarRating';

interface Props {
  averageRating?: number | null;
  reviewCount?: number;
  lang: 'ka' | 'en';
}

export default function LearningRatingSummary({ averageRating, reviewCount, lang }: Props) {
  // Older API responses during a rolling deployment have no rating fields.
  if (reviewCount == null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 my-2">
      {averageRating != null && <>
        <StarRating value={averageRating} size="sm" label={lang === 'ka' ? 'შეფასება' : 'Rating'} />
        <span className="font-bold">{averageRating.toFixed(1)} / 5</span>
      </>}
      <span>{reviewCount} {lang === 'ka' ? 'შეფასება' : reviewCount === 1 ? 'review' : 'reviews'}</span>
    </div>
  );
}
