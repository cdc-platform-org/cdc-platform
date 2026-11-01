import { useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Camera, X } from 'lucide-react';

export const MAX_CHARACTER_PHOTO_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CharacterPhotoFieldProps {
  photoUrl: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

// Optional photo of the main character. Validates type/size in the browser
// (the backend validates again and re-encodes the image).
export default function CharacterPhotoField({ photoUrl, disabled, onSelect, onRemove }: CharacterPhotoFieldProps) {
  const { t } = useTranslation('childrensBook');
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError(t('photoWrongType'));
      return;
    }
    if (file.size > MAX_CHARACTER_PHOTO_BYTES) {
      setLocalError(t('photoTooLarge', { mb: MAX_CHARACTER_PHOTO_BYTES / (1024 * 1024) }));
      return;
    }
    setLocalError(null);
    onSelect(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('photoLabel')}</label>
      <p className="text-xs text-gray-500 mb-2">{t('photoHint')}</p>
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <div className="relative">
            <img src={photoUrl} alt={t('photoLabel')} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              aria-label={t('photoRemove')}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-300 text-gray-600 flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
            <Camera className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-purple-300 disabled:opacity-50"
        >
          {photoUrl ? t('photoChange') : t('photoChoose')}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleChange} />
      </div>
      <p className="text-xs text-gray-400 mt-2">{t('photoPrivacy')}</p>
      {localError && <p className="text-xs text-red-600 mt-1">{localError}</p>}
    </div>
  );
}
