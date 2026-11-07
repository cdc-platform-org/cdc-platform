import { useState } from 'react';
import { CheckCircle2, ImageIcon } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { styleSampleUrl } from '../../../services/childrensBookService';

// Illustration style picker with a sample picture per style (the same scene
// drawn in each style), so the parent sees the difference instead of
// guessing from a name. Samples come from the backend, which draws each one
// once and caches it; until a sample exists the card shows a soft gradient
// tile with the style's short description instead.

export type IllustrationStyleValue = 'STORYBOOK_WATERCOLOR' | 'MODERN_3D' | 'SOFT_DIGITAL' | 'CARTOON' | 'FANTASY' | 'CLASSIC';

export const ILLUSTRATION_STYLE_OPTIONS: Array<{ value: IllustrationStyleValue; labelKey: string; hintKey: string; tile: string }> = [
  { value: 'STORYBOOK_WATERCOLOR', labelKey: 'styleWatercolor', hintKey: 'styleWatercolorHint', tile: 'from-sky-100 via-rose-50 to-amber-100' },
  { value: 'MODERN_3D', labelKey: 'styleModern3d', hintKey: 'styleModern3dHint', tile: 'from-orange-200 via-amber-100 to-sky-200' },
  { value: 'SOFT_DIGITAL', labelKey: 'styleSoftDigital', hintKey: 'styleSoftDigitalHint', tile: 'from-pink-100 via-violet-100 to-teal-100' },
  { value: 'CARTOON', labelKey: 'styleCartoon', hintKey: 'styleCartoonHint', tile: 'from-yellow-200 via-lime-200 to-cyan-200' },
  { value: 'FANTASY', labelKey: 'styleFantasy', hintKey: 'styleFantasyHint', tile: 'from-indigo-300 via-purple-300 to-fuchsia-200' },
  { value: 'CLASSIC', labelKey: 'styleClassic', hintKey: 'styleClassicHint', tile: 'from-stone-200 via-amber-50 to-emerald-100' },
];

function StyleThumbnail({ style, tile, alt }: { style: IllustrationStyleValue; tile: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br ${tile}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={styleSampleUrl(style)}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(failed || !loaded) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className={`h-8 w-8 text-white/80 drop-shadow ${failed ? '' : 'animate-pulse'}`} />
        </div>
      )}
    </div>
  );
}

export default function StylePicker({ value, onChange }: { value: IllustrationStyleValue; onChange: (value: IllustrationStyleValue) => void }) {
  const { t } = useTranslation('childrensBook');
  return (
    <div role="radiogroup" aria-label={t('illustrationStyleLabel')} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ILLUSTRATION_STYLE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`group relative flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition ${selected ? 'border-purple-600 bg-purple-50 shadow-md' : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'}`}
          >
            <StyleThumbnail style={option.value} tile={option.tile} alt={t(option.labelKey)} />
            <div className="px-1 pb-1">
              <div className={`text-sm font-semibold ${selected ? 'text-purple-800' : 'text-gray-800'}`}>{t(option.labelKey)}</div>
              <div className="mt-0.5 text-xs leading-snug text-gray-500">{t(option.hintKey)}</div>
            </div>
            {selected && <CheckCircle2 className="absolute right-3 top-3 h-6 w-6 rounded-full bg-white text-purple-600 shadow" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
