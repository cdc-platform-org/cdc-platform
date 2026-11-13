/**
 * One curriculum section with its lessons (rename, add lesson, delete).
 */
import { useState, FormEvent } from 'react';
import { AdminSection } from '../../../types/lms';
import { updateSection, deleteSection, createLesson, updateLesson, translateCourse } from '../../../services/courseService';
import { LessonRow } from './LessonRow';

export function SectionCard({ section, onChanged }: { section: AdminSection; onChanged: () => void }) {
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const handleAddLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;
    await createLesson(section.id, { title: lessonTitle.trim(), order: section.lessons.length });
    setLessonTitle('');
    setAddingLesson(false);
    onChanged();
  };

  const handleDeleteSection = async () => {
    if (!window.confirm('Delete this section and all its lessons?')) return;
    await deleteSection(section.id);
    onChanged();
  };

  // Translates this section's title plus every one of its lessons' titles
  // (and assignment prompts, where set) in one Gemini call, then persists
  // each result individually via the same updateSection/updateLesson calls
  // the rest of this editor already uses — onChanged() at the end refetches
  // the curriculum, which is what actually makes the new EN values show up
  // in this section's header and each LessonRow (see LessonRow's own
  // useEffect syncing titleEn/assignmentPromptEn from its lesson prop).
  const handleTranslateSection = async () => {
    setTranslateError(null);
    setTranslating(true);
    try {
      const translated = await translateCourse({
        sections: [
          {
            title: section.title,
            lessons: section.lessons.length
              ? section.lessons.map((l) => ({ title: l.title, assignmentPrompt: l.assignmentPrompt ?? undefined }))
              : undefined,
          },
        ],
      });
      const sectionResult = translated.sections?.[0];
      if (!sectionResult) throw new Error('No translation returned.');
      await updateSection(section.id, { titleEn: sectionResult.titleEn });
      await Promise.all(
        section.lessons.map((lesson, i) => {
          const lessonResult = sectionResult.lessons?.[i];
          if (!lessonResult) return Promise.resolve();
          return updateLesson(lesson.id, {
            titleEn: lessonResult.titleEn,
            assignmentPromptEn: lessonResult.assignmentPromptEn ?? null,
          });
        })
      );
      onChanged();
    } catch (err: any) {
      setTranslateError(err?.response?.data?.message ?? 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-900/60">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-900">{section.title}</span>
          {section.titleEn && <span className="block text-xs text-gray-400 truncate">{section.titleEn}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTranslateSection}
            disabled={translating}
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg disabled:opacity-60"
          >
            {translating ? 'Translating…' : '✨ Translate'}
          </button>
          <button type="button" onClick={handleDeleteSection} className="text-xs font-medium text-red-500 hover:text-red-700">
            Delete section
          </button>
        </div>
      </div>
      {translateError && <p className="px-4 pt-2 text-xs text-red-600">{translateError}</p>}
      {section.lessons.map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} onChanged={onChanged} />
      ))}
      {addingLesson ? (
        <form onSubmit={handleAddLesson} className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-slate-800">
          <input
            autoFocus
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            placeholder="Lesson title"
            className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Add</button>
          <button type="button" onClick={() => setAddingLesson(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddingLesson(true)}
          className="w-full text-left px-4 py-2.5 border-t border-gray-100 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          + Add lesson
        </button>
      )}
    </div>
  );
}
