import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { CheckCircle2, Loader2, PenLine, RefreshCw, Save } from 'lucide-react';
import {
  BookProject,
  MAX_EDITED_STORY_TEXT_LENGTH,
  MAX_STORY_TEXT_REGENERATIONS,
  StoryTextEdit,
} from '../../../services/childrensBookService';

type PlanPage = { pageNumber: number; storyText: string };

interface StoryTextEditorProps {
  book: BookProject;
  busy: boolean;
  // "review": before any image (save, new version, approve).
  // "edit": later, before payment (save or cancel).
  mode: 'review' | 'edit';
  onSave: (pages: StoryTextEdit[]) => Promise<void>;
  onApprove?: (pages: StoryTextEdit[]) => Promise<void>;
  onRegenerate?: () => Promise<void>;
  onCancel?: () => void;
}

function pagesOf(book: BookProject): PlanPage[] {
  return ((book.storyPlan?.pages ?? []) as PlanPage[]).slice().sort((a, b) => a.pageNumber - b.pageNumber);
}

// Simple per-page text editor: one plain text box per page, a character
// counter, and the actions for the current stage. The illustrations are
// drawn from this text, so the parent reviews it before any image exists.
export default function StoryTextEditor({ book, busy, mode, onSave, onApprove, onRegenerate, onCancel }: StoryTextEditorProps) {
  const { t } = useTranslation('childrensBook');
  const original = useMemo(() => pagesOf(book), [book]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  // Server text changed (saved, new version): start again from it.
  useEffect(() => {
    setDrafts(Object.fromEntries(original.map((p) => [p.pageNumber, p.storyText])));
  }, [original]);

  const changed: StoryTextEdit[] = original
    .filter((p) => (drafts[p.pageNumber] ?? p.storyText) !== p.storyText)
    .map((p) => ({ pageNumber: p.pageNumber, storyText: drafts[p.pageNumber] ?? '' }));
  const dirty = changed.length > 0;
  const invalid = original.some((p) => {
    const text = (drafts[p.pageNumber] ?? p.storyText).trim();
    return !text || text.length > MAX_EDITED_STORY_TEXT_LENGTH;
  });
  const regenerationsLeft = Math.max(0, MAX_STORY_TEXT_REGENERATIONS - (book.storyPlan?.textRegenerations ?? 0));

  async function save() {
    await onSave(changed);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  function regenerate() {
    if (!onRegenerate) return;
    if (dirty && !window.confirm(t('storyRegenerateConfirm'))) return;
    onRegenerate();
  }

  return (
    <section aria-labelledby="story-text-editor-title">
      <h2 id="story-text-editor-title" className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <PenLine className="w-5 h-5 text-purple-600" /> {mode === 'review' ? t('storyReviewTitle') : t('storyEditTitle')}
      </h2>
      <p className="text-sm text-gray-600 mb-4">{mode === 'review' ? t('storyReviewIntro') : t('storyEditIntro')}</p>

      <ol className="space-y-4 mb-5">
        {original.map((page) => {
          const value = drafts[page.pageNumber] ?? page.storyText;
          const length = value.trim().length;
          const tooLong = length > MAX_EDITED_STORY_TEXT_LENGTH;
          const fieldId = `story-page-${page.pageNumber}`;
          return (
            <li key={page.pageNumber}>
              <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">{t('pageLabel', { number: page.pageNumber })}</label>
              <textarea
                id={fieldId}
                rows={4}
                disabled={busy}
                value={value}
                onChange={(e) => setDrafts((current) => ({ ...current, [page.pageNumber]: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50 ${!length || tooLong ? 'border-red-400' : 'border-gray-300'}`}
              />
              <div className="flex justify-between text-xs mt-1">
                <span className="text-red-600">{!length ? t('storyPageEmpty') : tooLong ? t('storyPageTooLong', { max: MAX_EDITED_STORY_TEXT_LENGTH }) : ''}</span>
                <span className={tooLong ? 'text-red-600' : 'text-gray-400'}>{t('storyCharCount', { count: length, max: MAX_EDITED_STORY_TEXT_LENGTH })}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        {mode === 'review' && onApprove && (
          <button
            disabled={busy || invalid}
            onClick={() => onApprove(changed)}
            className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t('storyApproveButton')}
          </button>
        )}
        <button
          disabled={busy || !dirty || invalid}
          onClick={save}
          className={`px-5 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1 ${mode === 'edit' ? 'bg-purple-600 text-white' : 'border border-gray-300 text-gray-700'}`}
        >
          <Save className="w-4 h-4" /> {t('storySaveButton')}
        </button>
        {mode === 'review' && onRegenerate && (
          <button
            disabled={busy || regenerationsLeft === 0}
            onClick={regenerate}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> {t('storyRegenerateButton', { count: regenerationsLeft })}
          </button>
        )}
        {mode === 'edit' && onCancel && (
          <button disabled={busy} onClick={onCancel} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50">
            {t('storyCancelButton')}
          </button>
        )}
        {dirty && !busy && <span className="text-xs text-amber-700">{t('storyUnsaved')}</span>}
        {savedNotice && !dirty && <span className="text-xs text-green-700">{t('storySaved')}</span>}
      </div>
      {mode === 'review' && <p className="text-xs text-gray-500 mt-3">{t('storyApproveHint')}</p>}
    </section>
  );
}
