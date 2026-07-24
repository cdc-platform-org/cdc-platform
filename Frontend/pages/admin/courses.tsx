import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { Course, CoursePayload, AdminSection, AdminLesson, Exam } from '../../src/types/lms';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getAdminCurriculum,
  createSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadLessonVideo,
  getExamSettings,
  updateExamSettings,
} from '../../src/services/courseService';

const DISCOUNT_PRESETS = [10, 20, 30, 40, 50, 60];

const emptyForm = {
  title: '',
  description: '',
  category: '',
  originalPrice: 0,
  published: false,
  mentorName: '',
  mentorTitle: '',
  thumbnailUrl: '',
  isOnSale: false,
  discountPercent: 20,
  discountPercentCustom: '',
  useCustomDiscount: false,
  // <input type="datetime-local"> value, e.g. "2026-08-01T14:30" — converted
  // to a full ISO string on submit.
  discountEndDate: '',
};

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function CourseForm({
  editingCourse,
  onSaved,
  onCancel,
}: {
  editingCourse: Course | null;
  onSaved: (course: Course) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCourse) {
      const presetMatch = editingCourse.discountPercent != null && DISCOUNT_PRESETS.includes(editingCourse.discountPercent);
      setForm({
        title: editingCourse.title,
        description: editingCourse.description,
        category: editingCourse.category,
        originalPrice: editingCourse.originalPrice,
        published: editingCourse.published,
        mentorName: editingCourse.mentorName ?? '',
        mentorTitle: editingCourse.mentorTitle ?? '',
        thumbnailUrl: editingCourse.thumbnailUrl ?? '',
        isOnSale: editingCourse.isOnSale,
        discountPercent: presetMatch ? editingCourse.discountPercent! : DISCOUNT_PRESETS[1],
        discountPercentCustom: !presetMatch && editingCourse.discountPercent != null ? String(editingCourse.discountPercent) : '',
        useCustomDiscount: !presetMatch && editingCourse.discountPercent != null,
        discountEndDate: editingCourse.discountEndDate ? editingCourse.discountEndDate.slice(0, 16) : '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingCourse]);

  const effectiveDiscountPercent = form.useCustomDiscount ? Number(form.discountPercentCustom) || 0 : form.discountPercent;
  const previewPrice = form.isOnSale && effectiveDiscountPercent > 0
    ? Math.round(form.originalPrice * (1 - effectiveDiscountPercent / 100))
    : form.originalPrice;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.title.trim().length < 3) return setError('Title is too short.');
    if (form.description.trim().length < 20) return setError('Description is too short.');
    if (!form.category.trim()) return setError('Category is required.');
    if (form.isOnSale && effectiveDiscountPercent <= 0) return setError('Enter a valid discount percentage.');

    setSubmitting(true);
    try {
      const payload: CoursePayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        originalPrice: Number(form.originalPrice) || 0,
        published: form.published,
        mentorName: form.mentorName.trim() || undefined,
        mentorTitle: form.mentorTitle.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
        isOnSale: form.isOnSale,
        discountPercent: form.isOnSale ? effectiveDiscountPercent : null,
        discountEndDate: form.isOnSale && form.discountEndDate ? new Date(form.discountEndDate).toISOString() : null,
        // Legacy field still required by the create schema — the real
        // curriculum lives in sections/lessons, managed below once the
        // course exists.
        lessons: [{ title: form.title.trim(), content: form.description.trim(), durationMinutes: 1 }],
      };
      const saved = editingCourse ? await updateCourse(editingCourse.id, payload) : await createCourse(payload);
      onSaved(saved);
      if (!editingCourse) setForm(emptyForm);
    } catch {
      setError('Unable to save course. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Original Price (minor units)</label>
          <input
            type="number"
            min={0}
            value={form.originalPrice}
            onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">{formatGel(form.originalPrice)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mentor Name</label>
          <input value={form.mentorName} onChange={(e) => setForm({ ...form, mentorName: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mentor Title</label>
          <input value={form.mentorTitle} onChange={(e) => setForm({ ...form, mentorTitle: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Thumbnail URL</label>
        <input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} className={inputClass} placeholder="https://..." />
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isOnSale}
            onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
          />
          🏷️ Discount / Sale
        </label>

        {form.isOnSale && (
          <div className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount</label>
                <select
                  value={form.useCustomDiscount ? 'custom' : String(form.discountPercent)}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setForm({ ...form, useCustomDiscount: true });
                    } else {
                      setForm({ ...form, useCustomDiscount: false, discountPercent: Number(e.target.value) });
                    }
                  }}
                  className={inputClass}
                >
                  {DISCOUNT_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}%
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {form.useCustomDiscount && (
                  <input
                    type="number"
                    min={1}
                    max={90}
                    placeholder="e.g. 35"
                    value={form.discountPercentCustom}
                    onChange={(e) => setForm({ ...form, discountPercentCustom: e.target.value })}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sale Ends (optional)</label>
                <input
                  type="datetime-local"
                  value={form.discountEndDate}
                  onChange={(e) => setForm({ ...form, discountEndDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm">
              <span className="text-gray-500 line-through mr-2">{formatGel(form.originalPrice)}</span>
              <span className="font-black text-rose-600">{formatGel(previewPrice)}</span>
              <span className="text-rose-500 font-bold ml-2">-{effectiveDiscountPercent}%</span>
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Published
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? 'Saving…' : editingCourse ? 'Update Course' : 'Create Course'}
        </button>
        {editingCourse && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function LessonRow({ lesson, onChanged }: { lesson: AdminLesson; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualVideoId, setManualVideoId] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      await uploadLessonVideo(lesson.id, file, setUploadPct);
      onChanged();
    } catch {
      alert('Direct upload failed — you can paste a Bunny Stream Video ID or embed URL instead using "Set Bunny Video ID" below.');
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
      alert('Unable to save that Bunny Video ID.');
    } finally {
      setSavingManual(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this lesson?')) return;
    await deleteLesson(lesson.id);
    onChanged();
  };

  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
        <span className={`w-2 h-2 rounded-full shrink-0 ${lesson.bunnyVideoId ? 'bg-emerald-500' : 'bg-gray-300'}`} title={lesson.bunnyVideoId ? 'Video set' : 'No video yet'} />
        <span className="flex-1 truncate text-gray-800">{lesson.title}</span>
        <label className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer px-2 py-1 rounded hover:bg-indigo-50">
          {uploading ? `Uploading ${uploadPct}%…` : lesson.bunnyVideoId ? 'Replace video' : 'Upload video'}
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput((v) => !v)}
          className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
        >
          Set Bunny Video ID
        </button>
        <button type="button" onClick={handleDelete} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
          Delete
        </button>
      </div>
      {showManualInput && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            value={manualVideoId}
            onChange={(e) => setManualVideoId(e.target.value)}
            placeholder="Enter Bunny Stream Video ID or Embed URL…"
            className="flex-1 text-xs rounded-lg border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleSaveManualId}
            disabled={savingManual}
            className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingManual ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, onChanged }: { section: AdminSection; onChanged: () => void }) {
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');

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

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <span className="text-sm font-semibold text-gray-900">{section.title}</span>
        <button type="button" onClick={handleDeleteSection} className="text-xs font-medium text-red-500 hover:text-red-700">
          Delete section
        </button>
      </div>
      {section.lessons.map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} onChanged={onChanged} />
      ))}
      {addingLesson ? (
        <form onSubmit={handleAddLesson} className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100">
          <input
            autoFocus
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            placeholder="Lesson title"
            className="flex-1 text-sm rounded-lg border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

const emptyExamForm = {
  passingScore: 95,
  cooldownHours: 24,
  questionCount: 10,
  aiPromptContext: '',
};

function ExamSettingsPanel({ course }: { course: Course }) {
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
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">🎓 AI Certification Exam — {course.title}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {exam ? 'Configured — students must pass this exam (after 100% lesson completion) to unlock their certificate.' : 'Not configured yet — students fall back to the old 100%-lessons certificate gate.'}
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Passing Score (%)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Retake Cooldown (hours)</label>
              <input
                type="number"
                min={0}
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Count</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AI Prompt Context (optional)</label>
            <textarea
              rows={2}
              value={form.aiPromptContext}
              onChange={(e) => setForm({ ...form, aiPromptContext: e.target.value })}
              placeholder="e.g. Emphasize practical scenarios over theory; keep difficulty moderate."
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Saving…' : exam ? 'Update Exam Settings' : 'Enable Exam'}
            </button>
            {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function CurriculumEditor({ course }: { course: Course }) {
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
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Curriculum — {course.title}</h3>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
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
                placeholder="Section title"
                className={inputClass}
              />
              <button type="submit" className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Add</button>
              <button type="button" onClick={() => setAddingSection(false)} className="shrink-0 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + Add section
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AdminCoursesDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await getCourses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (course: Course) => {
    setCourses((prev) => {
      const exists = prev.some((c) => c.id === course.id);
      return exists ? prev.map((c) => (c.id === course.id ? course : c)) : [course, ...prev];
    });
    setEditingCourse(null);
    if (!managingCourse) setManagingCourse(course);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this course and its entire curriculum?')) return;
    await deleteCourse(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (managingCourse?.id === id) setManagingCourse(null);
  };

  return (
    <>
      <Head>
        <title>Courses | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Course Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create courses, then manage their sections, lessons, and lesson videos.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">{editingCourse ? 'Edit Course' : 'New Course'}</h2>
          <CourseForm editingCourse={editingCourse} onSaved={handleSaved} onCancel={() => setEditingCourse(null)} />
          {managingCourse && <CurriculumEditor course={managingCourse} />}
          {managingCourse && <ExamSettingsPanel course={managingCourse} />}
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Courses ({courses.length})</h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <div key={course.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {course.category}
                      </span>
                      {!course.published && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Draft</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">{course.title}</h3>
                    {course.mentorName && <p className="text-xs text-gray-500">{course.mentorName} · {course.mentorTitle}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setManagingCourse(course)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-50"
                    >
                      Curriculum
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCourse(course)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(course.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminCoursesPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminCoursesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
