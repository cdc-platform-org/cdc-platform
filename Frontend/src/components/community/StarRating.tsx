import { useId, useState } from 'react';

interface StarRatingProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  // Interactive mode (used by ReviewModal's picker) — omit for read-only display.
  onChange?: (value: number) => void;
  label?: string;
  starLabel?: (value: number) => string;
}

const SIZE_CLASSES: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
};

export default function StarRating({ value, size = 'md', onChange, label = 'Rating', starLabel = (star) => `${star} star${star > 1 ? 's' : ''}` }: StarRatingProps) {
  const groupId = useId();
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const interactive = typeof onChange === 'function';
  const displayValue = interactive && hoverValue !== null ? hoverValue : value;
  const stars = [1, 2, 3, 4, 5];

  return (
    <div
      className={`inline-flex items-center gap-1 ${SIZE_CLASSES[size]}`}
      onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? label : `${label}: ${value.toFixed(1)} / 5`}
    >
      {stars.map((star) => {
        const filled = star <= Math.round(displayValue);
        const className = `leading-none transition-transform duration-150 ${
          interactive ? 'cursor-pointer hover:scale-125' : ''
        } ${filled ? 'text-amber-400' : 'text-gray-300'}`;
        return interactive ? (
          <label key={star} className={className} onMouseEnter={() => setHoverValue(star)}>
            <input
              type="radio"
              name={groupId}
              value={star}
              checked={value === star}
              onChange={() => onChange!(star)}
              aria-label={starLabel(star)}
              className="peer sr-only"
            />
            <span aria-hidden="true" className="rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-cyan-500">★</span>
          </label>
        ) : (
          <span
            key={star}
            aria-hidden="true"
            className={className}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
