/**
 * Admin create/edit form for a course: content (ka/en with AI translate),
 * pricing and discounts, media uploads, skills and mentor details.
 */
import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import RichTextEditor from '../../shared/RichTextEditor';
import Toast from '../../shared/Toast';
import CourseHeroBanner from '../../shared/CourseHeroBanner';
import { Course, CoursePayload, CourseLanguage } from '../../../types/lms';
import SkillPicker from '../../shared/SkillPicker';
import CourseAiToolsPicker from './CourseAiToolsPicker';
import AITranslateButton from '../AITranslateButton';
import { createCourse, updateCourse, uploadCourseThumbnail, uploadCourseCoverImage, uploadCourseMentorAvatar, translateCourse } from '../../../services/courseService';
import { DISCOUNT_PRESETS, emptyForm, formatGel, inputClass } from './courseAdminShared';

import { at } from '../../../i18n/admin';
import { useCanSeeMoney } from '../useCanSeeMoney';
export function CourseForm({
  editingCourse,
  onSaved,
  onCancel,
}: {
  editingCourse: Course | null;
  onSaved: (course: Course) => void;
  onCancel: () => void;
}) {
  const canSeeMoney = useCanSeeMoney();
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
        // Money fields are absent for non-SUPER_ADMIN tiers (API strips them).
        originalPrice: (editingCourse.originalPrice ?? 0) / 100,
        maxCapacity: editingCourse.maxCapacity != null ? String(editingCourse.maxCapacity) : '',
        published: editingCourse.published,
        mentorName: editingCourse.mentorName ?? '',
        mentorTitle: editingCourse.mentorTitle ?? '',
        thumbnailUrl: editingCourse.thumbnailUrl ?? '',
        coverImageUrl: editingCourse.coverImageUrl ?? '',
        introVideoUrl: editingCourse.introVideoUrl ?? '',
        mentorAvatarUrl: editingCourse.mentorAvatarUrl ?? '',
        language: editingCourse.language ?? 'GEORGIAN',
        skillsTaught: editingCourse.skillsTaught ?? [],
        aiToolKeys: editingCourse.aiToolKeys ?? [],
        isOnSale: editingCourse.isOnSale ?? false,
        discountPercent: presetMatch ? editingCourse.discountPercent! : DISCOUNT_PRESETS[1],
        discountPercentCustom: !presetMatch && editingCourse.discountPercent != null ? String(editingCourse.discountPercent) : '',
        useCustomDiscount: !presetMatch && editingCourse.discountPercent != null,
        discountEndDate: editingCourse.discountEndDate ? editingCourse.discountEndDate.slice(0, 16) : '',
        discountBadgeText: editingCourse.discountBadgeText ?? '',
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
      setTranslateError(at("Fill in the Georgian Title and Description before translating."));
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
      setTranslateError(err?.response?.data?.message ?? at("Translation failed. Please try again."));
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
    if (form.title.trim().length < 3) return setError(at("Title is too short."));
    if (form.description.trim().length < 20) return setError(at("Description is too short."));
    if (!form.category.trim()) return setError(at("Category is required."));
    if (form.isOnSale && effectiveDiscountPercent <= 0) return setError(at("Enter a valid discount percentage."));

    setSubmitting(true);
    try {
      const payload: CoursePayload = {
        title: form.title.trim(),
        titleEn: form.titleEn.trim() || undefined,
        description: form.description.trim(),
        descriptionEn: form.descriptionEn.trim() || undefined,
        category: form.category.trim(),
        // Ignored by the API for non-SUPER_ADMIN tiers; sent as-is otherwise.
        originalPrice: Math.round((Number(form.originalPrice) || 0) * 100),
        maxCapacity: form.maxCapacity.trim() ? Math.round(Number(form.maxCapacity)) : null,
        published: form.published,
        mentorName: form.mentorName.trim() || undefined,
        mentorTitle: form.mentorTitle.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        introVideoUrl: form.introVideoUrl.trim() || undefined,
        mentorAvatarUrl: form.mentorAvatarUrl.trim() || undefined,
        language: form.language,
        skillsTaught: form.skillsTaught,
        // Only a SUPER_ADMIN may change included AI tools (backend enforces it too).
        ...(canSeeMoney ? { aiToolKeys: form.aiToolKeys } : {}),
        isOnSale: form.isOnSale,
        discountPercent: form.isOnSale ? effectiveDiscountPercent : null,
        discountEndDate: form.isOnSale && form.discountEndDate ? new Date(form.discountEndDate).toISOString() : null,
        discountBadgeText: form.isOnSale ? form.discountBadgeText.trim() || null : null,
        // Legacy field still required by the create schema — the real
        // curriculum lives in sections/lessons, managed below once the
        // course exists.
        lessons: [{ title: form.title.trim(), content: form.description.trim(), durationMinutes: 1 }],
      };
      const saved = editingCourse ? await updateCourse(editingCourse.id, payload) : await createCourse(payload);
      onSaved(saved);
      if (!editingCourse) setForm(emptyForm);
    } catch {
      setError(at("Unable to save course. Please try again."));
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
      setThumbnailError(at("Upload failed. Please try again."));
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
      setCoverImageError(at("Upload failed. Please try again."));
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
      setMentorAvatarError(at("Upload failed. Please try again."));
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
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Title")}</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Category")}</label>
          {/* Still free text (category has no DB enum — see /courses' own
              comment on why it derives filter chips from whatever values
              are actually present), but suggested via a native datalist —
              same pattern as englishTutor's NATIVE_LANG_SUGGESTIONS — so an
              admin can quickly pick the new "🤖 AI ციფრული მასწავლებლები"
              category (which drives the AI Teachers tab on /courses) rather
              than having to type it exactly. */}
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            list="admin-course-category-suggestions"
            className={inputClass}
          />
          <datalist id="admin-course-category-suggestions">
            <option value="🤖 AI ციფრული მასწავლებლები" />
          </datalist>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {at("Title (English)")}{" "}<span className="text-gray-400 font-normal">{at("— optional, prints as \"Title / Title (English)\" on the certificate")}</span>
        </label>
        <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Description")}</label>
        <RichTextEditor rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
      </div>
      <div>
        <AITranslateButton onClick={handleAutoTranslate} loading={translating} className="!mb-0" />
        {translateError && <p className="text-xs text-red-600 mt-1.5">{translateError}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {at("Description (English)")}{" "}<span className="text-gray-400 font-normal">{at("— optional, shown instead of Description when the site language is English")}</span>
        </label>
        <RichTextEditor rows={3} value={form.descriptionEn} onChange={(v) => setForm({ ...form, descriptionEn: v })} />
      </div>
      {showTranslateToast && <Toast message={at("✨ Translated to English")} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {at("Skills Taught")}{" "}<span className="text-gray-400 font-normal">{at("— auto-verifies these on a student's profile when they earn this course's certificate")}</span>
        </label>
        <SkillPicker value={form.skillsTaught} onChange={(skills) => setForm({ ...form, skillsTaught: skills })} lang="en" />
      </div>
      {canSeeMoney && (
        <CourseAiToolsPicker value={form.aiToolKeys} onChange={(keys) => setForm({ ...form, aiToolKeys: keys })} category={form.category} title={form.title} />
      )}
      <div className="grid md:grid-cols-3 gap-5">
        {canSeeMoney ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Original Price (GEL / ₾)")}</label>
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
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400 self-center">{at("Price is set by a Super Admin. A new course stays a draft until it has a price.")}</p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            {at("Max Capacity")}{" "}<span className="text-gray-400 font-normal">{at("— blank = unlimited")}</span>
          </label>
          <input
            type="number"
            min={1}
            step="1"
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })}
            placeholder={at("Unlimited")}
            className={inputClass}
          />
          {editingCourse && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {editingCourse.enrolledCount} {at("enrolled")}{editingCourse.maxCapacity != null ? ` / ${editingCourse.maxCapacity}` : ''}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Mentor Name")}</label>
          <input value={form.mentorName} onChange={(e) => setForm({ ...form, mentorName: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Mentor Title")}</label>
          <input value={form.mentorTitle} onChange={(e) => setForm({ ...form, mentorTitle: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Thumbnail")}</label>
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
                  {thumbnailUploading ? at("Uploading…") : form.thumbnailUrl ? at("Replace image") : at("Upload image")}
                </label>
                {thumbnailError && <p className="text-xs text-red-600 mt-1">{thumbnailError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{at("Save the course first, then you can upload a thumbnail image directly.")}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Cover Image (Hero Banner)")}</label>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
            {at("Full-bleed banners (with baked-in title text/diagrams) work best — this preview shows the whole image uncropped, exactly how it renders on the course page. High-res 16:9 recommended.")}
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
                  {coverImageUploading ? at("Uploading…") : form.coverImageUrl ? at("Replace image") : at("Upload image")}
                </label>
                {coverImageError && <p className="text-xs text-red-600 mt-1">{coverImageError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{at("Save the course first, then you can upload a cover image directly.")}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Intro / Preview Video (YouTube, Vimeo, or direct link)")}</label>
        <input
          value={form.introVideoUrl}
          onChange={(e) => setForm({ ...form, introVideoUrl: e.target.value })}
          placeholder={at("e.g. https://www.youtube.com/watch?v=...")}
          className={inputClass}
        />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          {at("Shown as an embedded player on the course detail page. Leave blank to show no preview.")}
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Mentor Avatar")}</label>
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
                  {mentorAvatarUploading ? at("Uploading…") : form.mentorAvatarUrl ? at("Replace image") : at("Upload image")}
                </label>
                {mentorAvatarError && <p className="text-xs text-red-600 mt-1">{mentorAvatarError}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{at("Save the course first, then you can upload a mentor avatar directly.")}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Instruction Language")}</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value as CourseLanguage })}
            className={inputClass}
          >
            <option value="GEORGIAN">{at("🇬🇪 Georgian")}</option>
            <option value="ENGLISH">{at("🇬🇧 English")}</option>
            <option value="BOTH">{at("🇬🇪🇬🇧 Both")}</option>
          </select>
        </div>
      </div>

      {canSeeMoney && (
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isOnSale}
            onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
          />
          {at("🏷️ Discount / Sale")}
        </label>

        {form.isOnSale && (
          <div className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Discount")}</label>
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
                  <option value="custom">{at("Custom…")}</option>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{at("Sale Ends (optional)")}</label>
                <input
                  type="datetime-local"
                  value={form.discountEndDate}
                  onChange={(e) => setForm({ ...form, discountEndDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {at("Badge Text")}{" "}<span className="text-gray-400 font-normal">{at("— optional, e.g. \"SPECIAL OFFER\" or \"BLACK FRIDAY\". Leave blank to show \"-")}{effectiveDiscountPercent}%".</span>
              </label>
              <input
                value={form.discountBadgeText}
                onChange={(e) => setForm({ ...form, discountBadgeText: e.target.value })}
                maxLength={40}
                placeholder={`-${effectiveDiscountPercent}%`}
                className={inputClass}
              />
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm">
              <span className="text-gray-500 line-through mr-2">{formatGel(form.originalPrice * 100)}</span>
              <span className="font-black text-rose-600">{formatGel(previewPrice * 100)}</span>
              <span className="text-rose-500 font-bold ml-2">{form.discountBadgeText.trim() || `-${effectiveDiscountPercent}%`}</span>
            </div>
          </div>
        )}
      </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
        />
        {at("Published")}
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? at("Saving…") : editingCourse ? at("Update Course") : at("Create Course")}
        </button>
        {editingCourse && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
            {at("Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
