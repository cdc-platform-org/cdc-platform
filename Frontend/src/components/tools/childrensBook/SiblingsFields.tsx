import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Plus, Trash2, Users } from 'lucide-react';
import CharacterPhotoField from './CharacterPhotoField';
import { BookProject, fetchCharacterPhotoUrl, removeCharacterPhoto, uploadCharacterPhoto } from '../../../services/childrensBookService';

export const MAX_SIBLINGS = 3;
const TEXT_FIELD_MAX = 500;

export interface SiblingDraft {
  name: string;
  age: string;
  appearance: string;
  photo: File | null;
  photoUrl: string | null;
}

export function emptySibling(): SiblingDraft {
  return { name: '', age: '', appearance: '', photo: null, photoUrl: null };
}

interface SiblingsFieldsProps {
  value: SiblingDraft[];
  onChange: (next: SiblingDraft[]) => void;
  disabled?: boolean;
}

// Create-form section: brothers/sisters who star in the same story, each
// with a name and optional age, appearance and photo (uploaded after the
// book is created).
export default function SiblingsFields({ value, onChange, disabled }: SiblingsFieldsProps) {
  const { t } = useTranslation('childrensBook');

  function update(index: number, patch: Partial<SiblingDraft>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function setPhoto(index: number, file: File | null) {
    const old = value[index]?.photoUrl;
    if (old) URL.revokeObjectURL(old);
    update(index, { photo: file, photoUrl: file ? URL.createObjectURL(file) : null });
  }

  function remove(index: number) {
    const old = value[index]?.photoUrl;
    if (old) URL.revokeObjectURL(old);
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        <Users className="w-4 h-4 text-purple-600" /> {t('siblingsTitle')}
      </label>
      <p className="text-xs text-gray-500 mb-3">{t('siblingsHint', { max: MAX_SIBLINGS })}</p>
      <div className="space-y-3">
        {value.map((sibling, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-800">{t('siblingNumber', { number: index + 1 })}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(index)}
                className="text-xs text-red-600 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('removeSibling')}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('siblingNameLabel')}</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  maxLength={60}
                  placeholder={t('siblingNamePlaceholder')}
                  value={sibling.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('siblingAgeLabel')}</label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  value={sibling.age}
                  onChange={(e) => update(index, { age: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('siblingAppearanceLabel')}</label>
                <textarea
                  rows={2}
                  maxLength={TEXT_FIELD_MAX}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  placeholder={t('appearancePlaceholder')}
                  value={sibling.appearance}
                  onChange={(e) => update(index, { appearance: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3">
                <CharacterPhotoField
                  label={t('siblingPhotoLabel')}
                  hint={t('siblingPhotoHint')}
                  photoUrl={sibling.photoUrl}
                  disabled={disabled}
                  onSelect={(file) => setPhoto(index, file)}
                  onRemove={() => setPhoto(index, null)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {value.length < MAX_SIBLINGS && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, emptySibling()])}
          className="mt-3 px-3 py-2 rounded-lg border border-dashed border-purple-300 text-purple-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> {t('addSibling')}
        </button>
      )}
    </div>
  );
}

interface SiblingPhotoEditorProps {
  book: BookProject;
  index: number;
  disabled?: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  onUpdated: (book: BookProject) => void;
}

// Wizard: change or remove one sibling's photo before the character is
// approved. Fetches its own thumbnail (authenticated blob URL).
export function SiblingPhotoEditor({ book, index, disabled, run, onUpdated }: SiblingPhotoEditorProps) {
  const { t } = useTranslation('childrensBook');
  const sibling = book.characterConfig?.siblings?.[index];
  const photoKey = sibling?.photoKey;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    if (photoKey) {
      fetchCharacterPhotoUrl(book.id, index).then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          created = u;
          setUrl(u);
        }
      }).catch(() => {});
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [book.id, index, photoKey]);

  if (!sibling) return null;
  return (
    <CharacterPhotoField
      label={t('siblingPhotoFor', { name: sibling.name })}
      hint={t('siblingPhotoHint')}
      photoUrl={url}
      disabled={disabled}
      onSelect={(file) => run(async () => onUpdated(await uploadCharacterPhoto(book.id, file, index)))}
      onRemove={() => run(async () => onUpdated(await removeCharacterPhoto(book.id, index)))}
    />
  );
}
