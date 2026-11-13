/**
 * "My courses" tab of /dashboard: enrolled courses with progress, a
 * continue link and the certificate download button once a course is 100%.
 * The certificate dialogs themselves are in CertificateModals.tsx.
 */
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
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
}

export default function CoursesTab({ t, user, courses, certificatesEarned, cert }: CoursesTabProps) {
  return (
    <div className="space-y-4">
      {user?.role === 'Student' && <FreelancerExamCard user={user} t={t} />}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-extrabold tracking-wide">{t.coursesTitle}</h2>
        {certificatesEarned > 0 && (
          <Link
            href="/dashboard/certificates"
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline no-underline whitespace-nowrap"
          >
            {t.viewAllCertificates} →
          </Link>
        )}
      </div>
      {courses.length === 0 ? (
        <div className={`${CARD_CLASS} p-10 text-center`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noCourses}</p>
          <Link
            href="/courses"
            className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
          >
            {t.browseCourses}
          </Link>
        </div>
      ) : (
        courses.map(({ course, progress, hasCertificate, certificateDownloadCount }) => (
          <div
            key={course.id}
            className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{course.title}</h3>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                <span>{t.progress}</span>
                <span>{progress.percent}%</span>
              </div>
              <ProgressBar percent={progress.percent} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Link
                href={`/courses/${course.id}/learn`}
                className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.continue}
              </Link>
              {progress.percent >= 100 ? (
                <button
                  type="button"
                  onClick={() => cert.requestCertificate(course.id, certificateDownloadCount)}
                  disabled={cert.downloadingCourseId === course.id}
                  className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  {cert.downloadingCourseId === course.id ? t.generating : t.downloadCert}
                </button>
              ) : (
                !hasCertificate && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 self-center">{t.certLocked}</span>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
