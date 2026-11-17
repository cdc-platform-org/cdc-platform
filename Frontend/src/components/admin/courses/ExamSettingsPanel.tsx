/**
 * Admin settings for a course's AI final exam (question count, pass mark, topics).
 */
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Course, Exam } from '../../../types/lms';
import { getExamSettings, updateExamSettings } from '../../../services/courseService';
import { inputClass } from './courseAdminShared';

import { at } from '../../../i18n/admin';
export const emptyExamForm = {
  passingScore: 95,
  cooldownHours: 24,
  questionCount: 10,
  aiPromptContext: '',
};

export function ExamSettingsPanel({ course }: { course: Course }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyExamForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExamSettings(course.id);
      setExam(data);
      if (data) {
        setForm({
          passingScore: data.passingScore,
          cooldownHours: data.cooldownHours,
          questionCount: data.questionCount,
          aiPromptContext: data.aiPromptContext ?? '',
        });
      } else {
        setForm(emptyExamForm);
      }
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateExamSettings(course.id, {
        passingScore: Number(form.passingScore),
        cooldownHours: Number(form.cooldownHours),
        questionCount: Number(form.questionCount),
        aiPromptContext: form.aiPromptContext.trim() || null,
      });
      setExam(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{at("🎓 AI Certification Exam —")}{" "}{course.title}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {exam ? at("Configured — students must pass this exam (after 100% lesson completion) to unlock their certificate.") : at("Not configured yet — students fall back to the old 100%-lessons certificate gate.")}
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">{at("Loading…")}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Passing Score (%)")}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.passingScore}
                onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Retake Cooldown (hours)")}</label>
              <input
                type="number"
                min={0}
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Question Count")}</label>
              <input
                type="number"
                min={3}
                max={30}
                value={form.questionCount}
                onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("AI Prompt Context (optional)")}</label>
            <textarea
              rows={2}
              value={form.aiPromptContext}
              onChange={(e) => setForm({ ...form, aiPromptContext: e.target.value })}
              placeholder={at("e.g. Emphasize practical scenarios over theory; keep difficulty moderate.")}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? at("Saving…") : exam ? at("Update Exam Settings") : at("Enable Exam")}
            </button>
            {saved && <span className="text-xs font-medium text-emerald-600">{at("Saved ✓")}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
