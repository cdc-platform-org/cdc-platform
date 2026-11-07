import { useTranslation } from 'next-i18next';
import { Check, Type } from 'lucide-react';
import { BookFontId, bookFontFamily, bookFontOptions, DEFAULT_BOOK_FONT, isBookFontId } from './bookFonts';

// The sample is in the BOOK's language (not the site's), so the parent sees
// exactly the letters that will be printed.
const SAMPLE: Record<string, { title: string; text: string }> = {
  KA: { title: 'ნინოს თავგადასავალი', text: 'ერთ მზიან დილას ნინო ჯადოსნურ ტყეში წავიდა…' },
  EN: { title: "Nino's Adventure", text: 'One sunny morning Nino walked into the magic forest…' },
};

interface Props {
  value: string | null | undefined;
  language: string;
  disabled?: boolean;
  onChange: (fontId: BookFontId) => void;
}

export default function BookFontPicker({ value, language, disabled, onChange }: Props) {
  const { t } = useTranslation('childrensBook');
  const selected: BookFontId = isBookFontId(value) ? value : DEFAULT_BOOK_FONT;
  const options = bookFontOptions(language);
  if (!options.includes(selected)) options.push(selected);
  const sample = SAMPLE[language] ?? SAMPLE.EN;

  return (
    <div data-testid="book-font-picker">
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        <Type className="w-4 h-4 text-purple-600" /> {t('fontLabel')}
      </label>
      <p className="text-xs text-gray-500 mb-2">{t('fontHint')}</p>
      <div role="radiogroup" aria-label={t('fontLabel')} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((id) => {
          const active = id === selected;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange(id)}
              className={`relative text-left rounded-lg border px-3 py-2.5 transition disabled:opacity-60 ${active ? 'border-purple-600 ring-2 ring-purple-200 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}
            >
              <span className="block text-xs font-medium text-purple-700 mb-1">{t(`font.${id}`)}</span>
              <span style={{ fontFamily: bookFontFamily(id) }} className="block text-gray-900">
                <span className="block font-bold text-base leading-snug">{sample.title}</span>
                <span className="block text-sm leading-snug text-gray-700">{sample.text}</span>
              </span>
              {active && <Check className="absolute top-2 right-2 w-4 h-4 text-purple-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
