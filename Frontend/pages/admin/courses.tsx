import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import RichTextEditor from '../../src/components/shared/RichTextEditor';
import Toast from '../../src/components/shared/Toast';
import CourseHeroBanner from '../../src/components/shared/CourseHeroBanner';
import { Course, CoursePayload, CourseLanguage, AdminSection, AdminLesson, Exam } from '../../src/types/lms';
import SkillPicker from '../../src/components/shared/SkillPicker';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getAdminCurriculum,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadLessonVideo,
  regenerateLessonSubtitles,
  uploadCourseThumbnail,
  uploadCourseCoverImage,
  uploadCourseMentorAvatar,
  getExamSettings,
  updateExamSettings,
  translateCourse,
} from '../../src/services/courseService';

const DISCOUNT_PRESETS = [10, 20, 30, 40, 50, 60];

const emptyForm = {
  title: '',
  titleEn: '',
  description: '',
  descriptionEn: '',
  category: '',
  originalPrice: 0,
  published: false,
  mentorName: '',
  mentorTitle: '',
  thumbnailUrl: '',
  coverImageUrl: '',
  mentorAvatarUrl: '',
  language: 'GEORGIAN' as CourseLanguage,
  skillsTaught: [] as string[],
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
  'w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

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
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [showTranslateToast, setShowTranslateToast] = useState(false);
  const translateToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const [mentorAvatarUploading, setMentorAvatarUploading] = useState(false);
  const [mentorAvatarError, setMentorAvatarError] = useState<string | null>(null);
  const mentorAvatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCourse) {
      const presetMatch = editingCourse.discountPercent != null && DISCOUNT_PRESETS.includes(editingCourse.discountPercent);
      setForm({
        title: editingCourse.title,
        titleEn: editingCourse.titleEn ?? '',
        description: editingCourse.description,
        descriptionEn: editingCourse.descriptionEn ?? '',
        category: editingCourse.category,
        originalPrice: editingCourse.originalPrice / 100,
        published: editingCourse.published,
        mentorName: editingCourse.mentorName ?? '',
        mentorTitle: editingCourse.mentorTitle ?? '',
        thumbnailUrl: editingCourse.thumbnailUrl ?? '',
        coverImageUrl: editingCourse.coverImageUrl ?? '',
        mentorAvatarUrl: editingCourse.mentorAvatarUrl ?? '',
        language: editingCourse.language ?? 'GEORGIAN',
        skillsTaught: editingCourse.skillsTaught ?? [],
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

  useEffect(() => {
    return () => {
      if (translateToastTimeoutRef.current) clearTimeout(translateToastTimeoutRef.current);
    };
  }, []);

  const handleAutoTranslate = async () => {
    setTranslateError(null);
    if (form.title.trim().length < 3 || form.description.trim().length < 20) {
      setTranslateError('Fill in the Georgian Title and Description before translating.');
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateCourse({ title: form.title.trim(), description: form.description.trim() });
      setForm((f) => ({
        ...f,
        titleEn: translated.titleEn ?? f.titleEn,
        descriptionEn: translated.descriptionEn ?? f.descriptionEn,
      }));
      setShowTranslateToast(true);
      if (translateToastTimeoutRef.current) clearTimeout(translateToastTimeoutRef.current);
      translateToastTimeoutRef.current = setTimeout(() => setShowTranslateToast(false), 4000);
    } catch (err: any) {
      setTranslateError(err?.response?.data?.message ?? 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

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
        titleEn: form.titleEn.trim() || undefined,
        description: form.description.trim(),
        descriptionEn: form.descriptionEn.trim() || undefined,
        category: form.category.trim(),
        originalPrice: Math.round((Number(form.originalPrice) || 0) * 100),
        published: form.published,
        mentorName: form.mentorName.trim() || undefined,
        mentorTitle: form.mentorTitle.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        mentorAvatarUrl: form.mentorAvatarUrl.trim() || undefined,
        language: form.language,
        skillsTaught: form.skillsTaught,
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

  const handleThumbnailFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCourse) return;
    setThumbnailError(null);
    setThumbnailUploading(true);
    try {
      const updated = await uploadCourseThumbnail(editingCourse.id, file);
      setForm((prev) => ({ ...prev, thumbnailUrl: updated.thumbnailUrl ?? '' }));
      onSaved(updated);
    } catch {
      setThumbnailError('Upload failed. Please try again.');
    } finally {
      setThumbnailUploading(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    }
  };

  const handleCoverImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCourse) return;
    setCoverImageError(null);
    setCoverImageUploading(true);
    try {
      const updated = await uploadCourseCoverImage(editingCourse.id, file);
      setForm((prev) => ({ ...prev, coverImageUrl: updated.coverImageUrl ?? '' }));
      onSaved(updated);
    } catch {
      setCoverImageError('Upload failed. Please try again.');
    } finally {
      setCoverImageUploading(false);
      if (coverImageInputRef.current) coverImageInputRef.current.value = '';
    }
  };

  const handleMentorAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCourse) return;
    setMentorAvatarError(null);
    setMentorAvatarUploading(true);
    try {
      const updated = await uploadCourseMentorAvatar(editingCourse.id, file);
      setForm((prev) => ({ ...prev, mentorAvatarUrl: updated.mentorAvatarUrl ?? '' }));
      onSaved(updated);
    } catch {
      setMentorAvatarError('Upload failed. Please try again.');
    } finally {
      setMentorAvatarUploading(false);
      if (mentorAvatarInputRef.current) mentorAvatarInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Category</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Title (English) <span className="text-gray-400 font-normal">— optional, prints as "Title / Title (English)" on the certificate</span>
        </label>
        <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Description</label>
        <RichTextEditor rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
      </div>
      <div>
        <button
          type="button"
          onClick={handleAutoTranslate}
          disabled={translating}
          className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {translating ? 'Translating…' : '✨ Auto-Translate to English via Gemini'}
        </button>
        {translateError && <p className="text-xs text-red-600 mt-1.5">{translateError}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Description (English) <span className="text-gray-400 font-normal">— optional, shown instead of Description when the site language is English</span>
        </label>
        <RichTextEditor rows={3} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
      </div>
      {showTranslateToast && <Toast message="✨ Translated to English" />}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          Skills Taught <span className="text-gray-400 font-normal">— auto-verifies these on a student's profile when they earn this course's certificate</span>
        </label>
        <SkillPicker value={form.skillsTaught} onChange={(skills) => setForm({ ...form, skillsTaught: skills })} lang="en" />
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Original Price (GEL / ₾)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.originalPrice}
            onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatGel(form.originalPrice * 100)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Mentor Name</label>
          <input value={form.mentorName} onChange={(e) => setForm({ ...form, mentorName: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Mentor Title</label>
          <input value={form.mentorTitle} onChange={(e) => setForm({ ...form, mentorTitle: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Thumbnail</label>
          {editingCourse ? (
            <div className="flex items-center gap-3">
              {form.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-slate-700 shrink-0" />
              )}
              <div>
                <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailFile} disabled={thumbnailUploading} className="hidden" id="thumbnail-file-input" />
                <label
                  htmlFor="thumbnail-file-input"
                  className="inline-block text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-100"
                >
                  {thumbnailUploading ? 'Uploading…' : form.thumbnailUrl ? 'Replace image' : 'Upload image'}
                </label>
                {thumbnailError && <p className="text-xs text-red-600 mt-1">{thumbnailError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Save the course first, then you can upload a thumbnail image directly.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Cover Image (Hero Banner)</label>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
            Full-bleed banners (with baked-in title text/diagrams) work best — this preview shows the whole image uncropped,
            exactly how it renders on the course page. High-res 16:9 recommended.
          </p>
          {editingCourse ? (
            <div className="space-y-3">
              {form.coverImageUrl && (
                <CourseHeroBanner src={form.coverImageUrl} alt="" className="max-w-sm" enableLightbox />
              )}
              <div>
                <input ref={coverImageInputRef} type="file" accept="image/*" onChange={handleCoverImageFile} disabled={coverImageUploading} className="hidden" id="cover-image-file-input" />
                <label
                  htmlFor="cover-image-file-input"
                  className="inline-block text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-100"
                >
                  {coverImageUploading ? 'Uploading…' : form.coverImageUrl ? 'Replace image' : 'Upload image'}
                </label>
                {coverImageError && <p className="text-xs text-red-600 mt-1">{coverImageError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Save the course first, then you can upload a cover image directly.</p>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Mentor Avatar</label>
          {editingCourse ? (
            <div className="flex items-center gap-3">
              {form.mentorAvatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.mentorAvatarUrl} alt="" className="w-12 h-16 rounded-lg object-cover border border-gray-200 shrink-0" />
              )}
              <div>
                <input ref={mentorAvatarInputRef} type="file" accept="image/*" onChange={handleMentorAvatarFile} disabled={mentorAvatarUploading} className="hidden" id="mentor-avatar-file-input" />
                <label
                  htmlFor="mentor-avatar-file-input"
                  className="inline-block text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-100"
                >
                  {mentorAvatarUploading ? 'Uploading…' : form.mentorAvatarUrl ? 'Replace image' : 'Upload image'}
                </label>
                {mentorAvatarError && <p className="text-xs text-red-600 mt-1">{mentorAvatarError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Save the course first, then you can upload a mentor avatar directly.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Instruction Language</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value as CourseLanguage })}
            className={inputClass}
          >
            <option value="GEORGIAN">🇬🇪 Georgian</option>
            <option value="ENGLISH">🇬🇧 English</option>
            <option value="BOTH">🇬🇪🇬🇧 Both</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-200 cursor-pointer">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Discount</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Sale Ends (optional)</label>
                <input
                  type="datetime-local"
                  value={form.discountEndDate}
                  onChange={(e) => setForm({ ...form, discountEndDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm">
              <span className="text-gray-500 line-through mr-2">{formatGel(form.originalPrice * 100)}</span>
              <span className="font-black text-rose-600">{formatGel(previewPrice * 100)}</span>
              <span className="text-rose-500 font-bold ml-2">-{effectiveDiscountPercent}%</span>
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
        />
        Published
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? 'Saving…' : editingCourse ? 'Update Course' : 'Create Course'}
        </button>
        {editingCourse && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
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

  const handleTogglePreview = async () => {
    setTogglingPreview(true);
    try {
      await updateLesson(lesson.id, { isFreePreview: !lesson.isFreePreview });
      onChanged();
    } catch {
      alert('Unable to update free-preview status.');
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
      alert(err?.response?.data?.message || 'Unable to start subtitle regeneration.');
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
      alert('Unable to add resource — make sure it is a valid URL.');
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
      alert('Unable to save the assignment prompt.');
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
      alert('Unable to save the English translation.');
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
          ? `Direct upload failed: ${serverMessage}\n\nYou can paste a Bunny Stream Video ID or embed URL instead using "Set Bunny Video ID" below.`
          : 'Direct upload failed — you can paste a Bunny Stream Video ID or embed URL instead using "Set Bunny Video ID" below.'
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
        <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{lesson.title}</span>
        <label className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer px-2 py-1 rounded hover:bg-indigo-50">
          {uploading ? `Uploading ${uploadPct}%…` : lesson.bunnyVideoId ? 'Replace video' : 'Upload video'}
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput((v) => !v)}
          className="shrink-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          Set Bunny Video ID
        </button>
        <button
          type="button"
          onClick={handleTogglePreview}
          disabled={togglingPreview}
          title="Toggle whether this lesson is watchable without purchasing"
          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded border ${
            lesson.isFreePreview
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
          } disabled:opacity-50`}
        >
          {togglingPreview ? '…' : lesson.isFreePreview ? '🔓 Free Preview' : '🔒 Paid Only'}
        </button>
        {lesson.subtitlesStatus && (
          <span
            title={lesson.subtitlesStatus === 'FAILED' ? lesson.subtitlesError ?? undefined : 'Auto-generated ka/en/ru captions'}
            className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded border ${
              lesson.subtitlesStatus === 'COMPLETED'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : lesson.subtitlesStatus === 'FAILED'
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}
          >
            CC{' '}
            {lesson.subtitlesStatus === 'COMPLETED'
              ? '✓'
              : lesson.subtitlesStatus === 'FAILED'
              ? '✕'
              : lesson.subtitlesStatus === 'PROCESSING'
              ? '…'
              : '⏳'}
          </span>
        )}
        {lesson.bunnyVideoId && (
          <button
            type="button"
            onClick={handleRegenerateSubtitles}
            disabled={regeneratingSubtitles || lesson.subtitlesStatus === 'PROCESSING'}
            title="Re-run ka/en/ru subtitle generation for this lesson's video"
            className="shrink-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {regeneratingSubtitles ? '…' : '🔁 CC'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="shrink-0 text-xs font-medium px-2 py-1 rounded text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          More
        </button>
        <button type="button" onClick={handleDelete} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
          Delete
        </button>
      </div>
      {showMore && (
        <div className="px-4 pb-3 space-y-3 bg-gray-50/60 dark:bg-slate-900/40">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-slate-300 pt-2">
            <input type="checkbox" checked={lesson.isFreePreview} disabled={togglingPreview} onChange={handleTogglePreview} className="w-3.5 h-3.5" />
            Free preview (watchable without purchasing, on the course landing page)
          </label>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Title (English) — optional</p>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Filled in by the section's Translate action, or type your own"
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-2"
            />
            <p className="text-xs font-medium text-gray-700 mb-1">Assignment prompt (English) — optional</p>
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={assignmentPromptEn}
                onChange={(e) => setAssignmentPromptEn(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button type="button" onClick={handleSaveTranslations} disabled={savingTranslations} className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 shrink-0">
                {savingTranslations ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Resources</p>
            <div className="space-y-1 mb-1.5">
              {lesson.resources.map((url) => (
                <div key={url} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-gray-600 dark:text-slate-400 truncate">{url}</span>
                  <button type="button" onClick={() => handleRemoveResource(url)} disabled={savingResources} className="text-xs text-red-500 hover:text-red-700">
                    Remove
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
                Add
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Assignment prompt (optional)</p>
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={assignmentPrompt}
                onChange={(e) => setAssignmentPrompt(e.target.value)}
                placeholder="e.g. Upload your Figma link or design export"
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button type="button" onClick={handleSavePrompt} disabled={savingPrompt} className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 shrink-0">
                {savingPrompt ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showManualInput && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            value={manualVideoId}
            onChange={(e) => setManualVideoId(e.target.value)}
            placeholder="Enter Bunny Stream Video ID or Embed URL…"
            className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Passing Score (%)</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Retake Cooldown (hours)</label>
              <input
                type="number"
                min={0}
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Question Count</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">AI Prompt Context (optional)</label>
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
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
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
              <button type="button" onClick={() => setAddingSection(false)} className="shrink-0 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Cancel</button>
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
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

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

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTogglePublish = async (course: Course) => {
    setTogglingPublishId(course.id);
    try {
      const updated = await updateCourse(course.id, { published: !course.published });
      setCourses((prev) => prev.map((c) => (c.id === course.id ? updated : c)));
      if (editingCourse?.id === course.id) setEditingCourse(updated);
    } catch {
      alert('Unable to change publish status. Please try again.');
    } finally {
      setTogglingPublishId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Courses | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Course Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create courses, then manage their sections, lessons, and lesson videos.</p>
        </div>

        <div ref={formCardRef} className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
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
                <div key={course.id} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {course.category}
                      </span>
                      {!course.published && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Draft</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate mt-1">{course.title}</h3>
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
                      onClick={() => handleTogglePublish(course)}
                      disabled={togglingPublishId === course.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60 ${
                        course.published
                          ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                          : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      {togglingPublishId === course.id ? '…' : course.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(course)}
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
