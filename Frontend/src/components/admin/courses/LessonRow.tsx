/**
 * One editable lesson row in the curriculum editor: title, video upload
 * (Bunny Stream), subtitles and delete.
 */
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import RichTextEditor from '../../shared/RichTextEditor';
import { AdminLesson } from '../../../types/lms';
import { updateLesson, deleteLesson, uploadLessonVideo, regenerateLessonSubtitles } from '../../../services/courseService';

import { at, atf } from '../../../i18n/admin';
export function LessonRow({ lesson, onChanged }: { lesson: AdminLesson; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualVideoId, setManualVideoId] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [togglingPreview, setTogglingPreview] = useState(false);
  const [regeneratingSubtitles, setRegeneratingSubtitles] = useState(false);
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [savingResources, setSavingResources] = useState(false);
  const [assignmentPrompt, setAssignmentPrompt] = useState(lesson.assignmentPrompt ?? '');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [titleEn, setTitleEn] = useState(lesson.titleEn ?? '');
  const [assignmentPromptEn, setAssignmentPromptEn] = useState(lesson.assignmentPromptEn ?? '');
  const [savingTranslations, setSavingTranslations] = useState(false);
  const [conspectusLang, setConspectusLang] = useState<'Ka' | 'En' | 'Ru'>('Ka');
  const [conspectusKa, setConspectusKa] = useState(lesson.conspectusKa ?? '');
  const [conspectusEn, setConspectusEn] = useState(lesson.conspectusEn ?? '');
  const [conspectusRu, setConspectusRu] = useState(lesson.conspectusRu ?? '');
  const [savingConspectus, setSavingConspectus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unlike the other local-only form fields above, these two need to pick up
  // values written by SectionCard's "Translate" action (a sibling/parent
  // action, not this row's own save) once the curriculum refetches — a
  // plain useState initializer would go stale after that refetch since this
  // row never remounts (same lesson.id key).
  useEffect(() => {
    setTitleEn(lesson.titleEn ?? '');
    setAssignmentPromptEn(lesson.assignmentPromptEn ?? '');
  }, [lesson.titleEn, lesson.assignmentPromptEn]);

  // Same staleness reasoning as the useEffect above — a "🔁 Regenerate"
  // click re-runs the AI pipeline asynchronously and this row never
  // remounts, so the freshly-generated text has to be picked up from the
  // next curriculum refetch rather than a plain useState initializer.
  useEffect(() => {
    setConspectusKa(lesson.conspectusKa ?? '');
    setConspectusEn(lesson.conspectusEn ?? '');
    setConspectusRu(lesson.conspectusRu ?? '');
  }, [lesson.conspectusKa, lesson.conspectusEn, lesson.conspectusRu]);

  const handleTogglePreview = async () => {
    setTogglingPreview(true);
    try {
      await updateLesson(lesson.id, { isFreePreview: !lesson.isFreePreview });
      onChanged();
    } catch {
      alert(at("Unable to update free-preview status."));
    } finally {
      setTogglingPreview(false);
    }
  };

  const handleRegenerateSubtitles = async () => {
    setRegeneratingSubtitles(true);
    try {
      await regenerateLessonSubtitles(lesson.id);
      onChanged();
    } catch (err: any) {
      alert(err?.response?.data?.message || at("Unable to start subtitle regeneration."));
    } finally {
      setRegeneratingSubtitles(false);
    }
  };

  const handleAddResource = async () => {
    if (!newResourceUrl.trim()) return;
    setSavingResources(true);
    try {
      await updateLesson(lesson.id, { resources: [...lesson.resources, newResourceUrl.trim()] });
      setNewResourceUrl('');
      onChanged();
    } catch {
      alert(at("Unable to add resource — make sure it is a valid URL."));
    } finally {
      setSavingResources(false);
    }
  };

  const handleRemoveResource = async (url: string) => {
    setSavingResources(true);
    try {
      await updateLesson(lesson.id, { resources: lesson.resources.filter((r) => r !== url) });
      onChanged();
    } finally {
      setSavingResources(false);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await updateLesson(lesson.id, { assignmentPrompt: assignmentPrompt.trim() || null });
      onChanged();
    } catch {
      alert(at("Unable to save the assignment prompt."));
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSaveTranslations = async () => {
    setSavingTranslations(true);
    try {
      await updateLesson(lesson.id, {
        titleEn: titleEn.trim() || null,
        assignmentPromptEn: assignmentPromptEn.trim() || null,
      });
      onChanged();
    } catch {
      alert(at("Unable to save the English translation."));
    } finally {
      setSavingTranslations(false);
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      await uploadLessonVideo(lesson.id, file, setUploadPct);
      onChanged();
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      alert(
        serverMessage
          ? atf("Direct upload failed: {0}\n\nYou can paste a Bunny Stream Video ID or embed URL instead using \"Set Bunny Video ID\" below.", serverMessage)
          : at("Direct upload failed — you can paste a Bunny Stream Video ID or embed URL instead using \"Set Bunny Video ID\" below.")
      );
      setShowManualInput(true);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveManualId = async () => {
    if (!manualVideoId.trim()) return;
    setSavingManual(true);
    try {
      await updateLesson(lesson.id, { bunnyVideoId: manualVideoId.trim() });
      setManualVideoId('');
      setShowManualInput(false);
      onChanged();
    } catch {
      alert(at("Unable to save that Bunny Video ID."));
    } finally {
      setSavingManual(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(at("Delete this lesson?"))) return;
    await deleteLesson(lesson.id);
    onChanged();
  };

  // Saves all three languages together — simpler than a per-language save
  // button, and an admin polishing the AI draft is realistically editing
  // more than one language's text in the same sitting anyway.
  const handleSaveConspectus = async () => {
    setSavingConspectus(true);
    try {
      await updateLesson(lesson.id, {
        conspectusKa: conspectusKa.trim() || null,
        conspectusEn: conspectusEn.trim() || null,
        conspectusRu: conspectusRu.trim() || null,
      });
      onChanged();
    } catch {
      alert(at("Unable to save the conspectus."));
    } finally {
      setSavingConspectus(false);
    }
  };

  const CONSPECTUS_VALUE: Record<'Ka' | 'En' | 'Ru', string> = { Ka: conspectusKa, En: conspectusEn, Ru: conspectusRu };
  const CONSPECTUS_SETTER: Record<'Ka' | 'En' | 'Ru', (v: string) => void> = { Ka: setConspectusKa, En: setConspectusEn, Ru: setConspectusRu };

  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
        <span className={`w-2 h-2 rounded-full shrink-0 ${lesson.bunnyVideoId ? 'bg-emerald-500' : 'bg-gray-300'}`} title={lesson.bunnyVideoId ? at("Video set") : at("No video yet")} />
        <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{lesson.title}</span>
        <label className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer px-2 py-1 rounded hover:bg-indigo-50">
          {uploading ? atf("Uploading {0}%…", uploadPct) : lesson.bunnyVideoId ? at("Replace video") : at("Upload video")}
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput((v) => !v)}
          className="shrink-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          {at("Set Bunny Video ID")}
        </button>
        <button
          type="button"
          onClick={handleTogglePreview}
          disabled={togglingPreview}
          title={at("Toggle whether this lesson is watchable without purchasing")}
          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded border ${
            lesson.isFreePreview
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
          } disabled:opacity-50`}
        >
          {togglingPreview ? '…' : lesson.isFreePreview ? at("🔓 Free Preview") : at("🔒 Paid Only")}
        </button>
        {lesson.subtitlesStatus && (
          <span
            title={lesson.subtitlesStatus === 'FAILED' ? lesson.subtitlesError ?? undefined : at("Auto-generated ka/en/ru captions")}
            className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded border ${
              lesson.subtitlesStatus === 'COMPLETED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : lesson.subtitlesStatus === 'FAILED'
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}
          >
            {at("CC")}{' '}
            {lesson.subtitlesStatus === 'COMPLETED'
              ? '✓'
              : lesson.subtitlesStatus === 'FAILED'
              ? '✕'
              : lesson.subtitlesStatus === 'PROCESSING'
              ? '…'
              : '⏳'}
          </span>
        )}
        {lesson.conspectusStatus && (
          <span
            title={lesson.conspectusStatus === 'FAILED' ? lesson.conspectusError ?? undefined : at("Auto-generated ka/en/ru study notes")}
            className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded border ${
              lesson.conspectusStatus === 'COMPLETED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : lesson.conspectusStatus === 'FAILED'
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}
          >
            📝{' '}
            {lesson.conspectusStatus === 'COMPLETED'
              ? '✓'
              : lesson.conspectusStatus === 'FAILED'
              ? '✕'
              : lesson.conspectusStatus === 'PROCESSING'
              ? '…'
              : '⏳'}
          </span>
        )}
        {lesson.bunnyVideoId && (
          <button
            type="button"
            onClick={handleRegenerateSubtitles}
            disabled={regeneratingSubtitles || lesson.subtitlesStatus === 'PROCESSING'}
            title={at("Re-run ka/en/ru subtitle generation for this lesson's video")}
            className="shrink-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {regeneratingSubtitles ? '…' : at("🔁 CC")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="shrink-0 text-xs font-medium px-2 py-1 rounded text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          {at("More")}
        </button>
        <button type="button" onClick={handleDelete} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
          {at("Delete")}
        </button>
      </div>
      {showMore && (
        <div className="px-4 pb-3 space-y-3 bg-gray-50/60 dark:bg-slate-900/40">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-slate-300 pt-2">
            <input type="checkbox" checked={lesson.isFreePreview} disabled={togglingPreview} onChange={handleTogglePreview} className="w-3.5 h-3.5" />
            {at("Free preview (watchable without purchasing, on the course landing page)")}
          </label>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">{at("Title (English) — optional")}</p>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder={at("Filled in by the section's Translate action, or type your own")}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-2"
            />
            <p className="text-xs font-medium text-gray-700 mb-1">{at("Assignment prompt (English) — optional")}</p>
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={assignmentPromptEn}
                onChange={(e) => setAssignmentPromptEn(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button type="button" onClick={handleSaveTranslations} disabled={savingTranslations} className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 shrink-0">
                {savingTranslations ? at("Saving…") : at("Save")}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">{at("Resources")}</p>
            <div className="space-y-1 mb-1.5">
              {lesson.resources.map((url) => (
                <div key={url} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-gray-600 dark:text-slate-400 truncate">{url}</span>
                  <button type="button" onClick={() => handleRemoveResource(url)} disabled={savingResources} className="text-xs text-red-500 hover:text-red-700">
                    {at("Remove")}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
                placeholder="https://... (PDF, ZIP, image, external link)"
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button type="button" onClick={handleAddResource} disabled={savingResources} className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                {at("Add")}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">{at("Assignment prompt (optional)")}</p>
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={assignmentPrompt}
                onChange={(e) => setAssignmentPrompt(e.target.value)}
                placeholder={at("e.g. Upload your Figma link or design export")}
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button type="button" onClick={handleSavePrompt} disabled={savingPrompt} className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 shrink-0">
                {savingPrompt ? at("Saving…") : at("Save")}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-700">
                {at("Conspectus (AI study notes)")}{" "}{lesson.conspectusStatus === 'FAILED' && lesson.conspectusError && (
                  <span className="text-red-500 font-normal">— {lesson.conspectusError}</span>
                )}
              </p>
              {lesson.bunnyVideoId && (
                <button
                  type="button"
                  onClick={handleRegenerateSubtitles}
                  disabled={regeneratingSubtitles || lesson.subtitlesStatus === 'PROCESSING'}
                  title={at("Re-runs the same AI pass that also regenerates captions")}
                  className="shrink-0 text-[11px] font-medium text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded disabled:opacity-50"
                >
                  {regeneratingSubtitles ? at("Regenerating…") : at("✨ Regenerate")}
                </button>
              )}
            </div>
            <div className="flex gap-1 mb-1.5">
              {(['Ka', 'En', 'Ru'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setConspectusLang(l)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded ${
                    conspectusLang === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <RichTextEditor
              rows={4}
              value={CONSPECTUS_VALUE[conspectusLang]}
              onChange={CONSPECTUS_SETTER[conspectusLang]}
              placeholder={at("Generated automatically once a video is uploaded — or write/edit it by hand here.")}
              className="text-xs"
            />
            <button
              type="button"
              onClick={handleSaveConspectus}
              disabled={savingConspectus}
              className="mt-1.5 text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingConspectus ? at("Saving…") : at("Save conspectus")}
            </button>
          </div>
        </div>
      )}
      {showManualInput && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            value={manualVideoId}
            onChange={(e) => setManualVideoId(e.target.value)}
            placeholder={at("Enter Bunny Stream Video ID or Embed URL…")}
            className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="button"
            onClick={handleSaveManualId}
            disabled={savingManual}
            className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingManual ? at("Saving…") : at("Save")}
          </button>
        </div>
      )}
    </div>
  );
}
