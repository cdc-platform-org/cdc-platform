/**
 * The two certificate dialogs on /dashboard:
 *  - confirm-name modal shown before generating the PDF, and
 *  - "download limit reached" modal (one download per course).
 * State comes from useCertificateDownload.
 */
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { DashboardStrings } from './dashboardDict';
import { CertificateDownload } from './useCertificateDownload';

interface CertificateModalsProps {
  t: DashboardStrings;
  cert: CertificateDownload;
  /** The course whose certificate is being confirmed, or null when the modal is closed. */
  confirmCourse: { id: string; title: string } | null;
}

export default function CertificateModals({ t, cert, confirmCourse }: CertificateModalsProps) {
  return (
    <>
      {confirmCourse && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => cert.setConfirmCourseId(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.confirmTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.confirmBody}</p>
            <p className="text-lg font-bold text-cyan-600 dark:text-cyan-300 mb-1">{cert.certificateNameKa}</p>
            {cert.certificateNameEn && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{cert.certificateNameEn}</p>}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">{t.confirmChangeHint}</p>
            {cert.certDownloadError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{cert.certDownloadError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => cert.handleDownloadCertificate(confirmCourse.id, confirmCourse.title)}
                disabled={cert.downloadingCourseId === confirmCourse.id}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
              >
                {cert.downloadingCourseId === confirmCourse.id ? t.generating : t.confirmDownload}
              </button>
              <Link
                href="/dashboard/settings"
                className="w-full text-center text-sm font-bold px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.confirmChangeName}
              </Link>
              <button
                type="button"
                onClick={() => cert.setConfirmCourseId(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {cert.certLimitMessage && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => cert.setCertLimitMessage(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3">{t.certLimitTitle}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{cert.certLimitMessage}</p>
            <div className="flex flex-col gap-2">
              <a
                href={`mailto:${t.certLimitContactEmail}`}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition no-underline"
              >
                <Mail className="w-4 h-4" />
                {t.certLimitContactEmail}
              </a>
              <button
                type="button"
                onClick={() => cert.setCertLimitMessage(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.certLimitClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
