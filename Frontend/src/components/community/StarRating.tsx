import { useState } from 'react';

interface StarRatingProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  // Interactive mode (used by ReviewModal's picker) — omit for read-only display.
  onChange?: (value: number) => void;
}

const SIZE_CLASSES: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
};

export default function StarRating({ value, size = 'md', onChange }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const interactive = typeof onChange === 'function';
  const displayValue = interactive && hoverValue !== null ? hoverValue : value;
  const stars = [1, 2, 3, 4, 5];

  return (
    <div
      className={`inline-flex items-center gap-1 ${SIZE_CLASSES[size]}`}
      onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
    >
      {stars.map((star) => {
        const filled = star <= Math.round(displayValue);
        return (
          <span
            key={star}
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? `${star} star${star > 1 ? 's' : ''}` : undefined}
            tabIndex={interactive ? 0 : undefined}
            onMouseEnter={interactive ? () => setHoverValue(star) : undefined}
            onClick={interactive ? () => onChange!(star) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange!(star);
                    }
                  }
                : undefined
            }
            className={`leading-none transition-transform duration-150 ${
              interactive ? 'cursor-pointer hover:scale-125' : ''
            } ${filled ? 'text-amber-400' : 'text-gray-300'}`}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
