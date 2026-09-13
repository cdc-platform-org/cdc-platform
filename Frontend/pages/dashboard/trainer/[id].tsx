import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '@/src/components/auth/ProtectedRoute';
import SiteHeader from '@/src/components/layout/SiteHeader';
import {
  getAssignedTraining,
  getAssignedTrainingParticipants,
  getAssignedTrainingGuide,
  updateAssignedTrainingGuideDay,
  uploadTrainerVideo,
  deleteTrainerVideo,
  MyAssignedLiveTraining,
  TrainerParticipantEnrollment,
  TrainerGuide,
  TrainerGuideDayInput,
} from '@/src/services/trainerWorkspaceService';

// ============================================================
// IAKO Trainer Tools — assigned-training detail (Phase 1).
// Shows participants (minimal learner data only), Daily Guide
// day editing (content only, not renumbering) and the trainer
// video upload/removal. All of it is server-authorization-
// scoped — this page renders 404/403 states verbatim.
// ============================================================

const copy = {
  ka: {
    back: '← ტრენერის პანელი',
    participants: 'მონაწილეები',
    guides: 'დღის გზამკვლევი',
    video: 'ტრენერის ვიდეო',
    noParticipants: 'მონაწილეები ჯერ არ არიან.',
    noGuides: 'გზამკვლევი ჯერ არ არის დამატებული.',
    loading: 'იტვირთება…',
    error: 'ვერ ჩაიტვირთა. სცადეთ ხელახლა.',
    retry: 'ხელახლა ცდა',
    notFound: 'ტრენინგი ვერ მოიძებნა ან არ გაქვთ წვდომა.',
    save: 'შენახვა',
    saving: 'ინახება…',
    saved: 'შენახულია',
    editDay: 'რედაქტირება',
    uploadVideo: 'ვიდეოს ატვირთვა',
    uploading: 'ატვირთულობს…',
    removeVideo: 'ვიდეოს წაშლა',
    noVideo: 'ვიდეო ჯერ არ არის ატვირთული.',
    published: 'გამოქვეყნებული',
    draft: 'დრაფტი',
    day: 'დღე',
  },
  en: {
    back: '← Trainer Control Center',
    participants: 'Participants',
    guides: 'Daily Guides',
    video: 'Trainer video',
    noParticipants: 'No participants enrolled yet.',
    noGuides: 'No guide days created yet.',
    loading: 'Loading…',
    error: 'Could not load. Please try again.',
    retry: 'Retry',
    notFound: 'Training not found or you do not have access.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    editDay: 'Edit',
    uploadVideo: 'Upload video',
    uploading: 'Uploading…',
    removeVideo: 'Remove video',
    noVideo: 'No video uploaded yet.',
    published: 'Published',
    draft: 'Draft',
    day: 'Day',
  },
};

type Tab = 'participants' | 'guides' | 'video';

function AssignedTrainingContent() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = copy[lang];
  const [training, setTraining] = useState<MyAssignedLiveTraining | null>(null);
  const [participants, setParticipants] = useState<TrainerParticipantEnrollment[]>([]);
  const [guide, setGuide] = useState<TrainerGuide | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('participants');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; summary: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    setForbidden(false);
    try {
      const [trainingData, participantsData, guideData] = await Promise.all([
        getAssignedTraining(id),
        getAssignedTrainingParticipants(id),
        getAssignedTrainingGuide(id),
      ]);
      setTraining(trainingData);
      setParticipants(participantsData);
      setGuide(guideData);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) setForbidden(true);
      else if (status === 404) setForbidden(true);
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const startEditDay = (dayId: string, title: string, summary: string) => {
    setEditingDayId(dayId);
    setEditDraft({ title, summary });
    setSaveState('idle');
  };

  const saveDay = async (day: TrainerGuide['days'][number]) => {
    if (!editDraft) return;
    setSaveState('saving');
    try {
      const payload: TrainerGuideDayInput = {
        dayNumber: day.dayNumber,
        title: editDraft.title,
        summary: editDraft.summary,
        published: day.published,
        scheduledDate: day.scheduledDate,
        sourcePages: day.sourcePages ?? [],
        sections: day.sections,
      };
      await updateAssignedTrainingGuideDay(id, day.id, payload);
      setGuide((current) => current ? {
        ...current,
        days: current.days.map((d) => d.id === day.id ? { ...d, title: editDraft.title, summary: editDraft.summary } : d),
      } : current);
      setSaveState('saved');
      setEditingDayId(null);
    } catch {
      setSaveState('error');
    }
  };

  const handleVideoUpload = async (file: File | undefined) => {
    if (!file) return;
    setVideoUploading(true);
    setVideoError(null);
    try {
      await uploadTrainerVideo(id, file);
      setTraining((current) => current ? { ...current, trainerVideoUrl: 'uploaded' } : current);
      void load();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setVideoError(message ?? 'Upload failed.');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleVideoDelete = async () => {
    setVideoUploading(true);
    setVideoError(null);
    try {
      await deleteTrainerVideo(id);
      setTraining((current) => current ? { ...current, trainerVideoUrl: null } : current);
    } catch {
      setVideoError('Delete failed.');
    } finally {
      setVideoUploading(false);
    }
  };

  if (loading) return <p role="status" className="text-sm text-slate-500 dark:text-slate-400 p-6">{t.loading}</p>;
  if (forbidden) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-6 m-6">
        <p className="text-sm text-amber-800 dark:text-amber-300">{t.notFound}</p>
        <Link href="/dashboard/trainer" className="mt-3 inline-block text-sm underline">{t.back}</Link>
      </div>
    );
  }
  if (failed || !training) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-6 m-6">
        <p className="text-sm text-red-700 dark:text-red-300">{t.error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 underline text-sm">{t.retry}</button>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/dashboard/trainer" className="text-sm text-cyan-700 dark:text-cyan-300">{t.back}</Link>
      <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-3">{training.title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        {new Date(training.scheduledAt).toLocaleString()} · {participants.length} / {training.maxCapacity} {t.participants}
      </p>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 mt-6">
        {(['participants', 'guides', 'video'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
              activeTab === tab ? 'border-cyan-600 text-cyan-700 dark:text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {copy[lang][tab]}
          </button>
        ))}
      </div>

      {activeTab === 'participants' && (
        <section className="mt-6 space-y-2">
          {participants.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.noParticipants}</p>
          ) : (
            participants.map((participant) => (
              <div key={participant.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{participant.user.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{participant.user.email}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                  participant.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {participant.status}
                </span>
              </div>
            ))
          )}
        </section>
      )}

      {activeTab === 'guides' && (
        <section className="mt-6 space-y-3">
          {!guide || guide.days.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.noGuides}</p>
          ) : (
            guide.days.map((day) => {
              const metric = guide.metrics.find((m) => m.dayId === day.id);
              const isEditing = editingDayId === day.id;
              return (
                <div key={day.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        {t.day} {day.dayNumber} · {day.published ? t.published : t.draft}
                        {metric ? ` · ${metric.completedParticipants}/${metric.totalParticipants}` : ''}
                      </p>
                      {isEditing && editDraft ? (
                        <div className="mt-2 space-y-2">
                          <input
                            type="text"
                            value={editDraft.title}
                            onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-transparent text-slate-900 dark:text-slate-100"
                          />
                          <textarea
                            rows={3}
                            value={editDraft.summary}
                            onChange={(e) => setEditDraft({ ...editDraft, summary: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-transparent text-slate-900 dark:text-slate-100"
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void saveDay(day)} disabled={saveState === 'saving'} className="rounded-lg bg-cyan-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-60">
                              {saveState === 'saving' ? t.saving : t.save}
                            </button>
                            <button type="button" onClick={() => setEditingDayId(null)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm">
                              ✕
                            </button>
                            {saveState === 'error' && <span className="text-xs text-rose-600 self-center">{t.error}</span>}
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{day.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{day.summary}</p>
                          <button type="button" onClick={() => startEditDay(day.id, day.title, day.summary)} className="mt-3 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:underline">
                            {t.editDay}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {activeTab === 'video' && (
        <section className="mt-6 space-y-3">
          {training.trainerVideoUrl ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.video}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">{training.trainerVideoUrl}</p>
              <button type="button" onClick={() => void handleVideoDelete()} disabled={videoUploading} className="mt-3 rounded-lg border border-rose-300 text-rose-600 px-4 py-2 text-sm font-bold disabled:opacity-60">
                {t.removeVideo}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.noVideo}</p>
          )}
          <label className="inline-flex items-center justify-center rounded-lg bg-cyan-600 text-white px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-60">
            {videoUploading ? t.uploading : t.uploadVideo}
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={videoUploading} onChange={(e) => void handleVideoUpload(e.target.files?.[0])} />
          </label>
          {videoError && <p role="alert" className="text-xs text-rose-600">{videoError}</p>}
        </section>
      )}
    </main>
  );
}

export default function AssignedTrainingPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <Head><title>{id ? `Training ${id.slice(0, 8)}` : 'Training'} | Trainer | CDC</title></Head>
        <SiteHeader />
        {id ? <AssignedTrainingContent /> : <p className="p-6 text-sm text-slate-500">Loading…</p>}
      </div>
    </ProtectedRoute>
  );
}
