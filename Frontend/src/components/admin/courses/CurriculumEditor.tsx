/**
 * Curriculum editor for one course: sections, lessons and exam settings.
 */
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Course, AdminSection } from '../../../types/lms';
import { getAdminCurriculum, createSection } from '../../../services/courseService';
import { inputClass } from './courseAdminShared';
import { SectionCard } from './SectionCard';

import { at } from '../../../i18n/admin';
export function CurriculumEditor({ course }: { course: Course }) {
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSections(await getAdminCurriculum(course.id));
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) return;
    await createSection(course.id, { title: sectionTitle.trim(), order: sections.length });
    setSectionTitle('');
    setAddingSection(false);
    load();
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{at("Curriculum —")}{" "}{course.title}</h3>
      {loading ? (
        <p className="text-sm text-gray-400">{at("Loading…")}</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} onChanged={load} />
          ))}
          {addingSection ? (
            <form onSubmit={handleAddSection} className="flex items-center gap-2">
              <input
                autoFocus
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder={at("Section title")}
                className={inputClass}
              />
              <button type="submit" className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">{at("Add")}</button>
              <button type="button" onClick={() => setAddingSection(false)} className="shrink-0 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">{at("Cancel")}</button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              {at("+ Add section")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
