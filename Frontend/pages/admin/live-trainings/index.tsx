/**
 * /admin/live-trainings — create, edit and list live trainings.
 * This file owns form state and save logic; the form field groups and the
 * list are in src/components/admin/liveTrainings/ (ScheduleFields,
 * PriceFields, DiscountFields, CapacityFields, SessionDetailsFields,
 * MediaFields, IakoAssistantFields, LiveTrainingList).
 */
import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import KaToEnButton from '../../../src/components/admin/KaToEnButton';
import { LiveTraining } from '../../../src/types/liveTraining';
import { CourseLanguage } from '../../../src/types/lms';
import {
  getAdminLiveTrainings,
  createLiveTraining,
  updateLiveTraining,
  deleteLiveTraining,
  uploadLiveTrainingImage,
  regenerateLiveTrainingSynopsis,
  generateLiveTrainingWorkspace,
  LiveTrainingPayload,
} from '../../../src/services/adminLiveTrainingService';
import {
  IakoAssignmentMode, IakoKnowledgeSource, IakoProfile,
  assignIakoProfile, getIakoProfile, listIakoProfiles,
} from '../../../src/services/iakoAssistantService';
import ScheduleFields from '../../../src/components/admin/liveTrainings/ScheduleFields';
import PriceFields from '../../../src/components/admin/liveTrainings/PriceFields';
import DiscountFields from '../../../src/components/admin/liveTrainings/DiscountFields';
import CapacityFields from '../../../src/components/admin/liveTrainings/CapacityFields';
import SessionDetailsFields from '../../../src/components/admin/liveTrainings/SessionDetailsFields';
import MediaFields from '../../../src/components/admin/liveTrainings/MediaFields';
import IakoAssistantFields from '../../../src/components/admin/liveTrainings/IakoAssistantFields';
import LiveTrainingList from '../../../src/components/admin/liveTrainings/LiveTrainingList';

// <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" (local time, no
// timezone) — the backend requires full ISO 8601. Same UTC-anchoring
// reasoning as PostingForm.tsx's toIsoDatetime for a date-only input,
// except this one keeps the picked wall-clock time as UTC rather than
// reinterpreting it, since there's no separate timezone field to ask the
// admin for.
function toIsoDatetime(local: string): string {
  return local ? `${local}:00.000Z` : '';
}
function toLocalInput(iso: string): string {
  return iso ? iso.slice(0, 16) : '';
}

// AUDIT NOTE (fixed): a validation failure on POST/PUT /admin/live-trainings
// responds with { errors: ZodIssue[] } (see adminLiveTrainings.ts's
// safeParse branches), never { message }. Reading only err.response.data
// .message meant EVERY validation rejection — a malformed meetingUrl typed
// by hand, a bad date, whatever the real cause — fell through to the same
// generic "ტრენინგის შენახვა ვერ მოხერხდა" with no indication of what
// was actually wrong. This surfaces the real field + reason instead.
function extractSaveErrorMessage(err: any): string {
  const zodIssues = err?.response?.data?.errors as { path?: (string | number)[]; message?: string }[] | undefined;
  if (Array.isArray(zodIssues) && zodIssues.length > 0) {
    return zodIssues
      .map((issue) => (issue.path?.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .filter(Boolean)
      .join(' | ');
  }
  return err?.response?.data?.message ?? 'ტრენინგის შენახვა ვერ მოხერხდა. სცადეთ თავიდან.';
}

const emptyForm: Omit<LiveTrainingPayload, 'discountBadgeText'> & {
  scheduledAtLocal: string;
  startDateLocal: string;
  endDateLocal: string;
  discountEndDateLocal: string;
  // Narrowed to plain `string` for the controlled <input> above — always
  // '' rather than null/undefined while editing, same posture as every
  // other optional text field in this form (e.g. titleEn/scheduleDays).
  // Converted back to `string | null` only at submit time.
  discountBadgeText: string;
} = {
  title: '',
  description: '',
  category: '',
  scheduledAt: '',
  scheduledAtLocal: '',
  titleEn: '',
  descriptionEn: '',
  price: null,
  isOnSale: false,
  discountPercent: null,
  discountEndDateLocal: '',
  discountBadgeText: '',
  thumbnailUrl: '',
  videoUrl: '',
  minCapacity: 0,
  maxCapacity: 15,
  published: true,
  language: 'GEORGIAN' as CourseLanguage,
  meetingUrl: '',
  classroomUrl: '',
  recordingUrl: '',
  startDateLocal: '',
  endDateLocal: '',
  priceType: 'MONTHLY',
  durationMonths: null,
  scheduleDays: '',
  trainerVideoUrl: '',
  mediaConsentFormUrl: '',
};

function AdminLiveTrainingsDashboard() {
  const [trainings, setTrainings] = useState<LiveTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');
  const [imageUploading, setImageUploading] = useState(false);

  // AI Workspace generation — a pure "fill the two inputs below" action,
  // independent of the main submit's own submitting/formError state, so
  // generating doesn't disturb (or get disturbed by) an in-flight save.
  const [generatingWorkspace, setGeneratingWorkspace] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<{ kind: 'success' | 'partial' | 'error'; message: string } | null>(null);

  // Kept alongside `form`/`editingId` rather than folded into `form` itself
  // — synopsis text has its own save action and a "Regenerate" trigger, not
  // part of the main title/description/etc. submit, same separation
  // admin/courses.tsx's lesson conspectus editor uses.
  const [editingTraining, setEditingTraining] = useState<LiveTraining | null>(null);
  const [synopsisLang, setSynopsisLang] = useState<'Ka' | 'En' | 'Ru'>('Ka');
  const [synopsisKa, setSynopsisKa] = useState('');
  const [synopsisEn, setSynopsisEn] = useState('');
  const [synopsisRu, setSynopsisRu] = useState('');
  const [savingSynopsis, setSavingSynopsis] = useState(false);
  const [regeneratingSynopsis, setRegeneratingSynopsis] = useState(false);

  // IAKO Assistant block — reads/writes the SAME IakoProfileAssignment the
  // Daily Guides admin page (guides.tsx) already assigns from; there is no
  // separate config table here. `iakoProfiles` is the one shared list both
  // pages derive "who's currently assigned to this training" from.
  const [iakoProfiles, setIakoProfiles] = useState<IakoProfile[]>([]);
  const [iakoEnabled, setIakoEnabled] = useState(false);
  const [iakoProfileId, setIakoProfileId] = useState('');
  // New assignments default to TESTING (Private) until an admin explicitly
  // picks LIVE — an existing assignment's real mode always overrides this
  // once loaded below.
  const [iakoMode, setIakoMode] = useState<IakoAssignmentMode>('TESTING');
  const [iakoDetail, setIakoDetail] = useState<(IakoProfile & { sources: IakoKnowledgeSource[] }) | null>(null);
  const [iakoWarning, setIakoWarning] = useState<string | null>(null);
  // Controlled auto-top-up — per-training policy layered on this same
  // assignment (see Backend's IakoProfileAssignment schema comment); never
  // touches the profile's own daily/hourly/screenshot/per-message defaults,
  // shown read-only in iakoDetail above.
  const [iakoInitialLimit, setIakoInitialLimit] = useState<string>('');
  const [iakoAutoTopUpEnabled, setIakoAutoTopUpEnabled] = useState(false);
  const [iakoAutoTopUpAmount, setIakoAutoTopUpAmount] = useState<string>('');
  const [iakoMaxAutoTopUps, setIakoMaxAutoTopUps] = useState<string>('1');
  const [iakoMaxAutoTotal, setIakoMaxAutoTotal] = useState<string>('');

  useEffect(() => {
    void listIakoProfiles().then(setIakoProfiles).catch(() => {});
  }, []);

  const assignedIakoProfile = editingId
    ? iakoProfiles.find((p) => p.assignments?.some((a) => a.liveTrainingId === editingId))
    : undefined;

  // Syncs the editable IAKO fields from the real assignment whenever we
  // start editing a training (or the profiles list finishes loading) —
  // never the other way around, so this is a read-sync, not a write.
  useEffect(() => {
    if (!editingId) {
      setIakoEnabled(false); setIakoProfileId(''); setIakoMode('TESTING');
      setIakoInitialLimit(''); setIakoAutoTopUpEnabled(false); setIakoAutoTopUpAmount(''); setIakoMaxAutoTopUps('1'); setIakoMaxAutoTotal('');
      return;
    }
    if (assignedIakoProfile) {
      const assignment = assignedIakoProfile.assignments!.find((a) => a.liveTrainingId === editingId)!;
      setIakoEnabled(true);
      setIakoProfileId(assignedIakoProfile.id);
      setIakoMode(assignment.mode);
      setIakoInitialLimit(assignment.initialRequestLimit != null ? String(assignment.initialRequestLimit) : '');
      setIakoAutoTopUpEnabled(assignment.autoTopUpEnabled);
      setIakoAutoTopUpAmount(assignment.autoTopUpAmount != null ? String(assignment.autoTopUpAmount) : '');
      setIakoMaxAutoTopUps(String(assignment.maxAutoTopUps || 1));
      setIakoMaxAutoTotal(assignment.maxAutoTotal != null ? String(assignment.maxAutoTotal) : '');
    } else {
      setIakoEnabled(false);
      setIakoProfileId('');
      setIakoMode('TESTING');
      setIakoInitialLimit(''); setIakoAutoTopUpEnabled(false); setIakoAutoTopUpAmount(''); setIakoMaxAutoTopUps('1'); setIakoMaxAutoTotal('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, iakoProfiles]);

  // Full profile detail (Knowledge Base doc/chunk counts, live active/vision
  // flags) — one cheap targeted fetch only for the currently-selected
  // profile, not a bulk fetch across every profile in the list.
  useEffect(() => {
    if (!iakoProfileId) { setIakoDetail(null); return; }
    let cancelled = false;
    void getIakoProfile(iakoProfileId).then((full) => { if (!cancelled) setIakoDetail(full); }).catch(() => { if (!cancelled) setIakoDetail(null); });
    return () => { cancelled = true; };
  }, [iakoProfileId]);

  // Same profile assigned to some OTHER resource — persona/Knowledge Base
  // are shared by design (see IakoProfileAssignment's own schema comment);
  // this is purely informational, computed from data already on hand.
  const iakoReusedElsewhere = iakoProfileId
    ? iakoProfiles.find((p) => p.id === iakoProfileId)?.assignments?.some((a) => (a.liveTrainingId && a.liveTrainingId !== editingId) || a.digitalToolKey)
    : false;

  const handleCoverImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploading(true);
    setFormError(null);
    try {
      const url = await uploadLiveTrainingImage(file);
      setForm((f) => ({ ...f, thumbnailUrl: url }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ფოტოს ატვირთვა ვერ მოხერხდა.');
    } finally {
      setImageUploading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrainings(await getAdminLiveTrainings());
    } catch {
      setError('ტრენინგების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditingTraining(null);
    setFormError(null);
    setIakoWarning(null);
    setActiveLangTab('ka');
  };

  const startEdit = (t: LiveTraining) => {
    setEditingId(t.id);
    setEditingTraining(t);
    setSynopsisKa(t.synopsisKa ?? '');
    setSynopsisEn(t.synopsisEn ?? '');
    setSynopsisRu(t.synopsisRu ?? '');
    setSynopsisLang('Ka');
    setForm({
      title: t.title,
      description: t.description,
      category: t.category,
      scheduledAt: t.scheduledAt,
      scheduledAtLocal: toLocalInput(t.scheduledAt),
      titleEn: t.titleEn ?? '',
      descriptionEn: t.descriptionEn ?? '',
      price: t.price,
      isOnSale: t.isOnSale,
      discountPercent: t.discountPercent,
      discountEndDateLocal: t.discountEndDate ? toLocalInput(t.discountEndDate) : '',
      discountBadgeText: t.discountBadgeText ?? '',
      thumbnailUrl: t.thumbnailUrl ?? '',
      videoUrl: t.videoUrl ?? '',
      minCapacity: t.minCapacity,
      maxCapacity: t.maxCapacity,
      published: t.published,
      language: t.language,
      meetingUrl: t.meetingUrl ?? '',
      classroomUrl: t.classroomUrl ?? '',
      recordingUrl: t.recordingUrl ?? '',
      startDateLocal: t.startDate ? toLocalInput(t.startDate) : '',
      endDateLocal: t.endDate ? toLocalInput(t.endDate) : '',
      priceType: t.priceType,
      durationMonths: t.durationMonths,
      scheduleDays: t.scheduleDays ?? '',
      trainerVideoUrl: t.trainerVideoUrl ?? '',
      mediaConsentFormUrl: t.mediaConsentFormUrl ?? '',
    });
    setActiveLangTab('ka');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSynopsis = async () => {
    if (!editingId) return;
    setSavingSynopsis(true);
    try {
      const updated = await updateLiveTraining(editingId, {
        synopsisKa: synopsisKa.trim() || null,
        synopsisEn: synopsisEn.trim() || null,
        synopsisRu: synopsisRu.trim() || null,
      });
      setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTraining(updated);
    } catch {
      setFormError('სინოფსისის შენახვა ვერ მოხერხდა.');
    } finally {
      setSavingSynopsis(false);
    }
  };

  const handleRegenerateSynopsis = async () => {
    if (!editingId) return;
    setRegeneratingSynopsis(true);
    try {
      await regenerateLiveTrainingSynopsis(editingId);
      // Fire-and-forget on the backend — reflect PROCESSING immediately so
      // the admin sees it started, without waiting on a full re-fetch.
      setEditingTraining((prev) => (prev ? { ...prev, synopsisStatus: 'PROCESSING', synopsisError: null } : prev));
      setTrainings((prev) => prev.map((t) => (t.id === editingId ? { ...t, synopsisStatus: 'PROCESSING', synopsisError: null } : t)));
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'სინოფსისის თავიდან გენერირება ვერ დაიწყო.');
    } finally {
      setRegeneratingSynopsis(false);
    }
  };

  const SYNOPSIS_VALUE: Record<'Ka' | 'En' | 'Ru', string> = { Ka: synopsisKa, En: synopsisEn, Ru: synopsisRu };
  const SYNOPSIS_SETTER: Record<'Ka' | 'En' | 'Ru', (v: string) => void> = { Ka: setSynopsisKa, En: setSynopsisEn, Ru: setSynopsisRu };

  // "✨ ავტომატური გენერაცია (AI Workspace)" — only fills the two inputs
  // below (setForm), never calls createLiveTraining/updateLiveTraining
  // itself, so the admin can review/edit/clear either link and only the
  // normal Save button actually persists anything.
  const handleGenerateWorkspace = async () => {
    if (form.title.trim().length < 3) return setWorkspaceStatus({ kind: 'error', message: 'ჯერ შეიყვანეთ სათაური (მინიმუმ 3 სიმბოლო).' });
    if (!form.scheduledAtLocal) return setWorkspaceStatus({ kind: 'error', message: 'ჯერ აირჩიეთ თარიღი და დრო.' });

    setGeneratingWorkspace(true);
    setWorkspaceStatus(null);
    try {
      const result = await generateLiveTrainingWorkspace({
        title: form.title.trim(),
        scheduledAt: toIsoDatetime(form.scheduledAtLocal),
        category: form.category.trim() || undefined,
      });
      setForm((prev) => ({
        ...prev,
        meetingUrl: result.meetingUrl ?? prev.meetingUrl,
        classroomUrl: result.classroomUrl ?? prev.classroomUrl,
      }));
      if (result.meetingUrl && result.classroomUrl) {
        setWorkspaceStatus({ kind: 'success', message: '✅ Google Meet და Classroom ბმულები დაგენერირდა და შეივსო ველებში.' });
      } else if (result.meetingUrl || result.classroomUrl) {
        setWorkspaceStatus({
          kind: 'partial',
          message: `⚠️ ნაწილობრივ წარმატებული: ${[!result.meetingUrl && 'Meet ბმული ვერ დაგენერირდა', !result.classroomUrl && 'Classroom ბმული ვერ დაგენერირდა'].filter(Boolean).join(', ')}. დეტალები: ${result.errors.join(' | ')}`,
        });
      } else {
        setWorkspaceStatus({ kind: 'error', message: `❌ ვერცერთი ბმული ვერ დაგენერირდა: ${result.errors.join(' | ')}` });
      }
    } catch (err: any) {
      setWorkspaceStatus({ kind: 'error', message: err?.response?.data?.message ?? '❌ Google Workspace-ის გენერაცია ვერ მოხერხდა.' });
    } finally {
      setGeneratingWorkspace(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIakoWarning(null);
    if (form.title.trim().length < 3) return setFormError('სათაური ძალიან მოკლეა.');
    if (form.description.trim().length < 10) return setFormError('აღწერა ძალიან მოკლეა.');
    if (!form.category.trim()) return setFormError('კატეგორია სავალდებულოა.');
    if (!form.scheduledAtLocal) return setFormError('თარიღი და დრო სავალდებულოა.');
    if (form.maxCapacity < 1) return setFormError('მაქსიმალური ადგილების რაოდენობა უნდა იყოს მინიმუმ 1.');
    if (form.minCapacity && form.minCapacity > form.maxCapacity) {
      return setFormError('მინიმალური ჯგუფი არ შეიძლება იყოს მაქსიმალურზე მეტი.');
    }
    if (form.isOnSale && !form.discountPercent) {
      return setFormError('ფასდაკლების პროცენტი სავალდებულოა, თუ ფასდაკლება ჩართულია.');
    }
    if (form.isOnSale && form.price == null) {
      return setFormError('უფასო ტრენინგს (ცარიელი ფასი) ფასდაკლება არ შეიძლება.');
    }
    if (iakoEnabled && !iakoProfileId) {
      return setFormError('IAKO-ს ჩასართავად აირჩიეთ ასისტენტის პროფილი (ან გამორთეთ IAKO).');
    }
    if (iakoEnabled && iakoAutoTopUpEnabled && (!iakoAutoTopUpAmount || !iakoMaxAutoTopUps || !iakoMaxAutoTotal)) {
      return setFormError('ავტომატური შევსების ჩასართავად მიუთითეთ თანხა, მაქსიმალური რაოდენობა და მაქსიმალური ჯამი.');
    }
    if (iakoEnabled && iakoAutoTopUpEnabled && Number(iakoMaxAutoTotal) < Number(iakoInitialLimit || iakoDetail?.defaultRequestLimit || 0)) {
      return setFormError('მაქსიმალური ჯამი არ შეიძლება იყოს საწყის ლიმიტზე ნაკლები.');
    }

    setSubmitting(true);
    const wasCreating = !editingId;
    try {
      const payload: LiveTrainingPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        scheduledAt: toIsoDatetime(form.scheduledAtLocal),
        titleEn: form.titleEn?.trim() || null,
        descriptionEn: form.descriptionEn?.trim() || null,
        price: form.price,
        isOnSale: form.isOnSale,
        discountPercent: form.isOnSale ? form.discountPercent : null,
        discountEndDate: form.isOnSale && form.discountEndDateLocal ? toIsoDatetime(form.discountEndDateLocal) : null,
        discountBadgeText: form.isOnSale ? form.discountBadgeText.trim() || null : null,
        thumbnailUrl: form.thumbnailUrl?.trim() || undefined,
        videoUrl: form.videoUrl?.trim() || '',
        minCapacity: form.minCapacity ?? 0,
        maxCapacity: form.maxCapacity,
        published: form.published,
        language: form.language,
        meetingUrl: form.meetingUrl?.trim() || undefined,
        classroomUrl: form.classroomUrl?.trim() || undefined,
        recordingUrl: form.recordingUrl?.trim() || undefined,
        startDate: form.startDateLocal ? toIsoDatetime(form.startDateLocal) : null,
        endDate: form.endDateLocal ? toIsoDatetime(form.endDateLocal) : null,
        priceType: form.priceType,
        durationMonths: form.durationMonths,
        scheduleDays: form.scheduleDays?.trim() || null,
        trainerVideoUrl: form.trainerVideoUrl?.trim() || '',
        mediaConsentFormUrl: form.mediaConsentFormUrl?.trim() || '',
      };
      let liveTrainingId = editingId;
      if (editingId) {
        const updated = await updateLiveTraining(editingId, payload);
        setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setEditingTraining(updated);
      } else {
        const created = await createLiveTraining(payload);
        setTrainings((prev) => [created, ...prev]);
        liveTrainingId = created.id;
        // Land in the edit view for the training we just created — if the
        // IAKO assignment call below fails, the admin is already on a real
        // retry/edit path instead of a form that reset back to empty.
        setEditingId(created.id);
        setEditingTraining(created);
      }

      // The Live Training record itself is now saved either way — an IAKO
      // assignment failure below must never look like (or actually cause)
      // the training save having failed, and must never prevent the form
      // from resetting the same way any other successful save does (a
      // network hiccup on this unrelated call must not strand the admin on
      // a stale "editing" view — see e2e/live-training-checkout.spec.ts's
      // "admin can preview and remove both saved video URLs").
      let iakoAssignmentFailed = false;
      try {
        if (iakoEnabled) {
          await assignIakoProfile({ liveTrainingId: liveTrainingId! }, iakoProfileId, iakoMode, {
            initialRequestLimit: iakoInitialLimit ? Number(iakoInitialLimit) : null,
            autoTopUpEnabled: iakoAutoTopUpEnabled,
            autoTopUpAmount: iakoAutoTopUpEnabled && iakoAutoTopUpAmount ? Number(iakoAutoTopUpAmount) : null,
            maxAutoTopUps: iakoAutoTopUpEnabled && iakoMaxAutoTopUps ? Number(iakoMaxAutoTopUps) : 0,
            maxAutoTotal: iakoAutoTopUpEnabled && iakoMaxAutoTotal ? Number(iakoMaxAutoTotal) : null,
          });
        } else if (assignedIakoProfile) {
          await assignIakoProfile({ liveTrainingId: liveTrainingId! }, null);
        }
      } catch {
        iakoAssignmentFailed = true;
        setIakoWarning(
          wasCreating
            ? 'ტრენინგი შეიქმნა, მაგრამ IAKO-ს კონფიგურაცია ვერ შეინახა. შეამოწმეთ პროფილი და დააჭირეთ „განახლებას" თავიდან საცდელად.'
            : 'ტრენინგი განახლდა, მაგრამ IAKO-ს კონფიგურაცია ვერ შეინახა. სცადეთ „განახლება" თავიდან.'
        );
      }
      // Best-effort — same "swallow and move on" posture as the mount
      // effect's own listIakoProfiles() call above; a failure here must
      // never block the form from resetting either.
      await listIakoProfiles().then(setIakoProfiles).catch(() => {});
      // Inlined rather than resetForm() (which also clears iakoWarning) —
      // a genuine IAKO failure's warning must survive this reset so the
      // admin actually sees it, not just the rest of the form clearing.
      setForm(emptyForm);
      setEditingId(null);
      setEditingTraining(null);
      setFormError(null);
      setActiveLangTab('ka');
      if (!iakoAssignmentFailed) setIakoWarning(null);
    } catch (err: any) {
      setFormError(extractSaveErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ტრენინგის წაშლა?')) return;
    try {
      await deleteLiveTraining(id);
      setTrainings((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      // Backend returns 409 + a real enrollment count when this training has
      // actual registrations (including completion history) — the admin
      // gets a second, specific confirmation naming exactly what's at stake
      // before force-deleting, instead of a blanket "everything will be
      // deleted" warning shown identically for a training with 0 or 50 sign-ups.
      const enrollmentCount = err?.response?.data?.enrollmentCount;
      if (err?.response?.status === 409 && typeof enrollmentCount === 'number') {
        if (!window.confirm(`ამ ტრენინგს აქვს ${enrollmentCount} რეგისტრაცია (მათ შორის დასრულებული). წაშლა სამუდამოდ წაშლის მათ. ნამდვილად გსურთ გაგრძელება?`)) return;
        try {
          await deleteLiveTraining(id, true);
          setTrainings((prev) => prev.filter((t) => t.id !== id));
          if (editingId === id) resetForm();
          return;
        } catch {
          setError('ტრენინგის წაშლა ვერ მოხერხდა.');
          return;
        }
      }
      setError('ტრენინგის წაშლა ვერ მოხერხდა.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>ლაივ ტრენინგები | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">ლაივ ტრენინგები / ვორქშოფები</h1>
          <p className="text-sm text-gray-500 mt-1">შექმენით ერთჯერადი ლაივ სესია და მართეთ რეგისტრირებული ლიდები.</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">{editingId ? 'ტრენინგის რედაქტირება' : 'ახალი ტრენინგი'}</h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <ScheduleFields form={form} setForm={setForm} inputClass={inputClass} />

            <PriceFields form={form} setForm={setForm} inputClass={inputClass} />

            <DiscountFields form={form} setForm={setForm} inputClass={inputClass} />

            <CapacityFields form={form} setForm={setForm} inputClass={inputClass} />

            <SessionDetailsFields
              form={form}
              setForm={setForm}
              inputClass={inputClass}
              handleGenerateWorkspace={handleGenerateWorkspace}
              generatingWorkspace={generatingWorkspace}
              workspaceStatus={workspaceStatus}
              editingId={editingId}
              editingTraining={editingTraining}
              handleRegenerateSynopsis={handleRegenerateSynopsis}
              regeneratingSynopsis={regeneratingSynopsis}
              setSynopsisLang={setSynopsisLang}
              synopsisLang={synopsisLang}
              SYNOPSIS_VALUE={SYNOPSIS_VALUE}
              SYNOPSIS_SETTER={SYNOPSIS_SETTER}
              handleSaveSynopsis={handleSaveSynopsis}
              savingSynopsis={savingSynopsis}
            />

            <MediaFields
              form={form}
              imageUploading={imageUploading}
              handleCoverImageChange={handleCoverImageChange}
              setForm={setForm}
              inputClass={inputClass}
            />

            <div className="flex gap-1 border-b border-gray-200">
              {(['ka', 'en'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveLangTab(tab)}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                    activeLangTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'ka' ? '🇬🇪 ქართული' : '🇬🇧 English'}
                </button>
              ))}
            </div>

            <KaToEnButton
              pairs={[{ ka: form.title }, { ka: form.description }]}
              onTranslated={([titleEn, descriptionEn]) => {
                setForm((f) => ({ ...f, ...(titleEn ? { titleEn } : {}), ...(descriptionEn ? { descriptionEn } : {}) }));
                setActiveLangTab('en');
              }}
            />

            {activeLangTab === 'ka' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">სათაური (KA)</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">აღწერა (KA)</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title (EN)</label>
                  <input type="text" value={form.titleEn ?? ''} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (EN)</label>
                  <textarea rows={3} value={form.descriptionEn ?? ''} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className={inputClass} />
                </div>
              </>
            )}

            <IakoAssistantFields
              iakoEnabled={iakoEnabled}
              setIakoEnabled={setIakoEnabled}
              iakoProfileId={iakoProfileId}
              setIakoProfileId={setIakoProfileId}
              inputClass={inputClass}
              iakoProfiles={iakoProfiles}
              iakoReusedElsewhere={iakoReusedElsewhere}
              setIakoMode={setIakoMode}
              iakoMode={iakoMode}
              iakoDetail={iakoDetail}
              iakoInitialLimit={iakoInitialLimit}
              setIakoInitialLimit={setIakoInitialLimit}
              iakoAutoTopUpEnabled={iakoAutoTopUpEnabled}
              setIakoAutoTopUpEnabled={setIakoAutoTopUpEnabled}
              iakoAutoTopUpAmount={iakoAutoTopUpAmount}
              setIakoAutoTopUpAmount={setIakoAutoTopUpAmount}
              iakoMaxAutoTopUps={iakoMaxAutoTopUps}
              setIakoMaxAutoTopUps={setIakoMaxAutoTopUps}
              iakoMaxAutoTotal={iakoMaxAutoTotal}
              setIakoMaxAutoTotal={setIakoMaxAutoTotal}
              iakoWarning={iakoWarning}
            />

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.published ?? true}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამოქვეყნებულია
            </label>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'გამოქვეყნება'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  გაუქმება
                </button>
              )}
            </div>
          </form>
        </div>

        <LiveTrainingList
          trainings={trainings}
          error={error}
          loading={loading}
          startEdit={startEdit}
          handleDelete={handleDelete}
        />
      </div>
    </>
  );
}

export default function AdminLiveTrainingsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminLiveTrainingsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
