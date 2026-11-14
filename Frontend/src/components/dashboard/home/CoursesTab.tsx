/**
 * "My courses" tab of /dashboard: enrolled courses with progress, a
 * continue link and the certificate download button once a course is 100%.
 * 2026-11 redesign (EDUPRO "My Courses"): Ongoing / Completed pill tabs and
 * horizontal cards with thumbnail, progress and actions on cdc-* tokens.
 * The certificate dialogs themselves are in CertificateModals.tsx.
 */
import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, PlayCircle } from 'lucide-react';
import { User } from '../../../types/auth';
import { MyCourseWithProgress } from '../../../types/lms';
import { DashboardStrings } from './dashboardDict';
import { CARD_CLASS, FreelancerExamCard, ProgressBar } from './dashboardShared';
import { CertificateDownload } from './useCertificateDownload';

interface CoursesTabProps {
  t: DashboardStrings;
  user: User | null | undefined;
  courses: MyCourseWithProgress[];
  certificatesEarned: number;
  cert: CertificateDownload;
  lang?: string;
}

export default function CoursesTab({ t, user, courses, certificatesEarned, cert, lang }: CoursesTabProps) {
  const ka = lang === 'ka';
  const [filter, setFilter] = useState<'ongoing' | 'completed'>('ongoing');
  const ongoing = courses.filter((c) => c.progress.percent < 100);
  const completed = courses.filter((c) => c.progress.percent >= 100);
  // Default to whichever list has something in it.
  const effectiveFilter = filter === 'ongoing' && ongoing.length === 0 && completed.length > 0 ? 'completed' : filter;
  const visible = effectiveFilter === 'ongoing' ? ongoing : completed;

  return (
    <div className="space-y-5">
      {user?.role === 'Student' && <FreelancerExamCard user={user} t={t} />}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-cdc-ink">{t.coursesTitle}</h2>
        {certificatesEarned > 0 && (
          <Link href="/dashboard/certificates" className="text-sm font-bold text-cdc-primary-ink hover:underline no-underline whitespace-nowrap">
            {t.viewAllCertificates} →
          </Link>
        )}
      </div>

      {courses.length > 0 && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-cdc-surface border border-cdc-border max-w-md">
          {([
            ['ongoing', ka ? `მიმდინარე (${ongoing.length})` : `Ongoing (${ongoing.length})`],
            ['completed', ka ? `დასრულებული (${completed.length})` : `Completed (${completed.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors ${
                effectiveFilter === key ? 'bg-cdc-primary text-white' : 'bg-transparent text-cdc-muted hover:text-cdc-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {courses.length === 0 ? (
        <div className={`${CARD_CLASS} p-10 text-center`}>
          <span className="mx-auto mb-4 w-14 h-14 rounded-full bg-cdc-primary-soft text-cdc-primary-ink flex items-center justify-center">
            <GraduationCap className="w-7 h-7" aria-hidden="true" />
          </span>
          <p className="text-sm text-cdc-muted mb-5">{t.noCourses}</p>
          <Link href="/courses" className="vip-btn-primary no-underline">
            {t.browseCourses}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(({ course, progress, hasCertificate, certificateDownloadCount }) => (
            <div key={course.id} className="vip-card hover:translate-y-0 p-4 flex flex-col sm:flex-row gap-4">
              <Link href={`/courses/${course.id}/learn`} className="shrink-0 w-full sm:w-44 aspect-video sm:aspect-[4/3] overflow-hidden rounded-xl bg-cdc-primary-soft flex items-center justify-center no-underline">
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <PlayCircle className="w-9 h-9 text-cdc-primary-ink" aria-hidden="true" />
                )}
              </Link>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="cdc-chip self-start">{course.category}</span>
                <h3 className="mt-2 font-bold text-base text-cdc-ink">{course.title}</h3>
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold text-cdc-muted mb-1.5">
                    <span>{t.progress}</span>
                    <span className="text-cdc-ink">{progress.percent}%</span>
                  </div>
                  <ProgressBar percent={progress.percent} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {progress.percent >= 100 ? (
                    <button
                      type="button"
                      onClick={() => cert.requestCertificate(course.id, certificateDownloadCount)}
                      disabled={cert.downloadingCourseId === course.id}
                      className="vip-btn-secondary cursor-pointer disabled:opacity-60"
                    >
                      <GraduationCap className="w-4 h-4" aria-hidden="true" />
                      {cert.downloadingCourseId === course.id ? t.generating : t.downloadCert}
                    </button>
                  ) : (
                    !hasCertificate && <span className="text-xs text-cdc-muted mr-auto">{t.certLocked}</span>
                  )}
                  <Link href={`/courses/${course.id}/learn`} className="vip-btn-primary no-underline">
                    {t.continue}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
