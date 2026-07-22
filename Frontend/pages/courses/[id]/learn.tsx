import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import CourseVideoPlayer from '../../../src/components/courses/CourseVideoPlayer';
import { LmsSection, LmsLesson, CourseProgressSummary, Course } from '../../../src/types/lms';
import {
  getCourse,
  getCurriculum,
  getProgressSummary,
  setLessonProgress,
  downloadCertificate,
} from '../../../src/services/courseService';

const dict = {
  ka: {
    overview: 'მიმოხილვა',
    resources: 'რესურსები',
    assignment: 'დავალება',
    noResources: 'ამ გაკვეთილს დამატებითი მასალა არ აქვს.',
    noAssignment: 'ამ კურსს ჯერ არ აქვს ფორმალური დავალების ჩაბარების სისტემა — გაკვეთილების დასრულებით მიაღწევთ 100%-იან პროგრესს.',
    curriculum: 'სილაბუსი',
    completed: 'დასრულებულია',
    certificate: '🎓 სერტიფიკატის ჩამოტვირთვა (PDF)',
    generating: 'გენერირდება…',
    loading: 'იტვირთება…',
    notEnrolled: 'თქვენ არ ხართ ჩარიცხული ამ კურსზე.',
    lessons: 'გაკვეთილი',
    back: 'კურსზე დაბრუნება',
  },
  en: {
    overview: 'Overview',
    resources: 'Resources',
    assignment: 'Assignment',
    noResources: 'This lesson has no attached resources.',
    noAssignment: "This course doesn't have a formal assignment submission system yet — complete every lesson to reach 100%.",
    curriculum: 'Curriculum',
    completed: 'Completed',
    certificate: '🎓 Download Certificate (PDF)',
    generating: 'Generating…',
    loading: 'Loading…',
    notEnrolled: 'You are not enrolled in this course.',
    lessons: 'lesson',
    back: 'Back to course',
  },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LearnContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const courseId = typeof router.query.id === 'string' ? router.query.id : null;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<LmsSection[]>([]);
  const [progress, setProgress] = useState<CourseProgressSummary | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'assignment'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);

  const allLessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections]);
  const activeLesson: LmsLesson | undefined = allLessons.find((l) => l.id === activeLessonId);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const [courseData, curriculumData, progressData] = await Promise.all([
        getCourse(courseId),
        getCurriculum(courseId),
        getProgressSummary(courseId),
      ]);
      setCourse(courseData);
      setSections(curriculumData);
      setProgress(progressData);
      setExpandedSectionIds(new Set(curriculumData.map((s) => s.id)));
      const firstIncomplete = curriculumData.flatMap((s) => s.lessons).find((l) => !l.completed);
      const first = curriculumData[0]?.lessons[0];
      setActiveLessonId((firstIncomplete ?? first)?.id ?? null);
    } catch {
      setError(t.notEnrolled);
    } finally {
      setLoading(false);
    }
  }, [courseId, t.notEnrolled]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleLessonComplete = async (lesson: LmsLesson, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !lesson.completed;
    setSections((prev) =>
      prev.map((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: nextCompleted } : l)) }))
    );
    try {
      await setLessonProgress(lesson.id, nextCompleted);
      if (courseId) setProgress(await getProgressSummary(courseId));
    } catch {
      setSections((prev) =>
        prev.map((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: !nextCompleted } : l)) }))
      );
    }
  };

  const handleDownloadCertificate = async () => {
    if (!courseId) return;
    setDownloadingCert(true);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${course?.title ?? courseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Unable to generate certificate.');
    } finally {
      setDownloadingCert(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t.loading}</div>;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        {error ?? t.notEnrolled}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Head>
        <title>{course.title} | CDC Learn</title>
      </Head>

      <div className="flex flex-col lg:flex-row">
        {/* MAIN CONTENT — ~70% */}
        <div className="flex-1 lg:w-[70%] p-4 md:p-8">
          <CourseVideoPlayer embedUrl={activeLesson?.embedUrl ?? null} title={activeLesson?.title ?? course.title} />

          <h1 className="text-xl font-bold mt-6">{activeLesson?.title ?? course.title}</h1>

          <div className="flex gap-2 mt-6 border-b border-slate-800">
            {(['overview', 'resources', 'assignment'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                  activeTab === tab ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t[tab]}
              </button>
            ))}
          </div>

          <div className="py-6 text-sm leading-relaxed text-slate-300">
            {activeTab === 'overview' && <p>{course.description}</p>}
            {activeTab === 'resources' &&
              (activeLesson?.resources.length ? (
                <ul className="space-y-2">
                  {activeLesson.resources.map((url, i) => (
                    <li key={i}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">{t.noResources}</p>
              ))}
            {activeTab === 'assignment' && <p className="text-slate-500">{t.noAssignment}</p>}
          </div>
        </div>

        {/* SIDEBAR — ~30% */}
        <aside className="lg:w-[30%] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/40 p-4 md:p-6">
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>{t.curriculum}</span>
              <span>{progress?.percent ?? 0}% {t.completed}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
          </div>

          {progress && progress.percent === 100 && (
            <button
              type="button"
              onClick={handleDownloadCertificate}
              disabled={downloadingCert}
              className="w-full mb-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm py-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
            >
              {downloadingCert ? t.generating : t.certificate}
            </button>
          )}

          <div className="space-y-3">
            {sections.map((section) => {
              const expanded = expandedSectionIds.has(section.id);
              return (
                <div key={section.id} className="rounded-xl border border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 text-left text-sm font-semibold cursor-pointer border-none text-slate-100"
                  >
                    <span>{section.title}</span>
                    <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {expanded && (
                    <div className="divide-y divide-slate-800/80">
                      {section.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs cursor-pointer border-none transition-colors ${
                            lesson.id === activeLessonId ? 'bg-cyan-500/10 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span
                            role="checkbox"
                            aria-checked={lesson.completed}
                            onClick={(e) => toggleLessonComplete(lesson, e)}
                            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                              lesson.completed ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-600 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex-1 truncate">{lesson.title}</span>
                          <span className="shrink-0 text-slate-500">{formatDuration(lesson.durationSeconds)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <ProtectedRoute>
      <LearnContent />
    </ProtectedRoute>
  );
}
