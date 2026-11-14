/**
 * Course curriculum list (EDUPRO-style 2026-11 redesign): one card per
 * section, lessons with numbered circles, a free-preview button or a lock
 * for guests, and lesson duration. Used on pages/courses/[id]/index.tsx.
 */
import { Lock, Play } from 'lucide-react';
import type { TFunction } from 'i18next';
import { SyllabusLesson, SyllabusSection } from '../../../types/lms';

function formatLessonDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface CourseSyllabusProps {
  syllabus: SyllabusSection[];
  enrolled: boolean;
  t: TFunction<'courses', undefined>;
  onPreview: (lesson: SyllabusLesson) => void;
  onLocked: () => void;
}

export default function CourseSyllabus({ syllabus, enrolled, t, onPreview, onLocked }: CourseSyllabusProps) {
  if (syllabus.length === 0) return <p className="text-sm text-cdc-muted">{t('noSyllabus')}</p>;
  let counter = 0;
  return (
    <div className="space-y-4">
      {syllabus.map((section, sIdx) => (
        <div key={section.id} className="rounded-card border border-cdc-border bg-cdc-surface overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-cdc-ink">
              <span className="text-cdc-primary-ink">{sIdx + 1}.</span> {section.title}
            </p>
            <span className="text-xs font-semibold text-cdc-muted shrink-0">
              {section.lessons.length} {t('courseLessons')}
            </span>
          </div>
          {section.lessons.length > 0 && (
            <ul className="list-none m-0 p-0 border-t border-cdc-border divide-y divide-cdc-border">
              {section.lessons.map((lesson) => {
                counter += 1;
                return (
                  <li key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-cdc-primary-soft text-cdc-primary-ink text-xs font-bold flex items-center justify-center">
                      {String(counter).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-cdc-ink">
                      {lesson.title}
                      <span className="block text-xs text-cdc-muted">{formatLessonDuration(lesson.durationSeconds)}</span>
                    </span>
                    {!enrolled &&
                      (lesson.isFreePreview && lesson.embedUrl ? (
                        <button
                          type="button"
                          onClick={() => onPreview(lesson)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-cdc-primary-ink bg-cdc-primary-soft border-none rounded-full px-3 py-1.5 cursor-pointer hover:opacity-90"
                        >
                          <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                          {t('preview')}
                        </button>
                      ) : (
                        <button type="button" onClick={onLocked} title={t('locked')} aria-label={t('locked')} className="w-9 h-9 shrink-0 rounded-full bg-cdc-bg text-cdc-muted flex items-center justify-center border-none cursor-pointer">
                          <Lock className="w-4 h-4" aria-hidden="true" />
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
