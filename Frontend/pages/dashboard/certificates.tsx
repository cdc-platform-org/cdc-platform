import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { GraduationCap, ExternalLink, Mail } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { useAuth } from '../../src/context/AuthContext';
import { useEscapeToClose } from '../../src/hooks/useEscapeToClose';
import { MyCourseWithProgress } from '../../src/types/lms';
import { getMyCourses, downloadCertificate } from '../../src/services/courseService';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'ჩემი სერტიფიკატები',
    subtitle: 'ყველა კურსი, რომლისთვისაც სერტიფიკატი გაცემულია.',
    loading: 'იტვირთება…',
    empty: 'თქვენ ჯერ არცერთი სერტიფიკატი არ მიგიღიათ.',
    browseCourses: 'კურსების დათვალიერება',
    issued: 'გაცემის თარიღი',
    code: 'ვერიფიკაციის კოდი',
    download: 'ჩამოტვირთვა',
    generating: 'გენერირდება…',
    verify: 'საჯარო ვერიფიკაცია',
    confirmTitle: 'გთხოვთ შეამოწმოთ!',
    confirmBody: 'სერტიფიკატზე დაიბეჭდება სახელი და გვარი:',
    confirmChangeHint: 'თუ გსურთ სახელის შეცვლა, გადადით პროფილის პარამეტრებში.',
    confirmDownload: 'დადასტურება და ჩამოტვირთვა',
    confirmChangeName: 'სახელის შეცვლა (პროფილში გადასვლა)',
    confirmCancel: 'გაუქმება',
    downloadFailed: 'სერტიფიკატის გენერირება ვერ მოხერხდა. სცადეთ თავიდან.',
    limitTitle: 'სერტიფიკატი უკვე ჩამოტვირთულია',
    limitMessage:
      'სერტიფიკატის განმეორებით ჩამოტვირთვისთვის ან მონაცემების შესაცვლელად, გთხოვთ დაუკავშირდეთ მხარდაჭერის გუნდს ელფოსტაზე: contact@cdc.org.ge',
    limitClose: 'დახურვა',
    limitContactEmail: 'contact@cdc.org.ge',
  },
  en: {
    title: 'My Certificates',
    subtitle: 'Every course you have an issued certificate for.',
    loading: 'Loading…',
    empty: "You haven't earned any certificates yet.",
    browseCourses: 'Browse Courses',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download',
    generating: 'Generating…',
    verify: 'Public verification',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    downloadFailed: 'Unable to generate the certificate. Please try again.',
    limitTitle: 'Certificate Already Downloaded',
    limitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    limitClose: 'Close',
    limitContactEmail: 'contact@cdc.org.ge',
  },
  de: {
    title: 'My Certificates',
    subtitle: 'Every course you have an issued certificate for.',
    loading: 'Loading…',
    empty: "You haven't earned any certificates yet.",
    browseCourses: 'Browse Courses',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download',
    generating: 'Generating…',
    verify: 'Public verification',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    downloadFailed: 'Unable to generate the certificate. Please try again.',
    limitTitle: 'Certificate Already Downloaded',
    limitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    limitClose: 'Close',
    limitContactEmail: 'contact@cdc.org.ge',
  },
  es: {
    title: 'My Certificates',
    subtitle: 'Every course you have an issued certificate for.',
    loading: 'Loading…',
    empty: "You haven't earned any certificates yet.",
    browseCourses: 'Browse Courses',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download',
    generating: 'Generating…',
    verify: 'Public verification',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    downloadFailed: 'Unable to generate the certificate. Please try again.',
    limitTitle: 'Certificate Already Downloaded',
    limitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    limitClose: 'Close',
    limitContactEmail: 'contact@cdc.org.ge',
  },
  fr: {
    title: 'My Certificates',
    subtitle: 'Every course you have an issued certificate for.',
    loading: 'Loading…',
    empty: "You haven't earned any certificates yet.",
    browseCourses: 'Browse Courses',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download',
    generating: 'Generating…',
    verify: 'Public verification',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    downloadFailed: 'Unable to generate the certificate. Please try again.',
    limitTitle: 'Certificate Already Downloaded',
    limitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    limitClose: 'Close',
    limitContactEmail: 'contact@cdc.org.ge',
  },
  uk: {
    title: 'My Certificates',
    subtitle: 'Every course you have an issued certificate for.',
    loading: 'Loading…',
    empty: "You haven't earned any certificates yet.",
    browseCourses: 'Browse Courses',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download',
    generating: 'Generating…',
    verify: 'Public verification',
    confirmTitle: 'Please double-check!',
    confirmBody: 'This name will be printed on your certificate:',
    confirmChangeHint: 'To change it, go to your account settings.',
    confirmDownload: 'Confirm & Download',
    confirmChangeName: 'Change Name (Go to Settings)',
    confirmCancel: 'Cancel',
    downloadFailed: 'Unable to generate the certificate. Please try again.',
    limitTitle: 'Certificate Already Downloaded',
    limitMessage:
      'To re-download your certificate or update its details, please contact our support team at: contact@cdc.org.ge',
    limitClose: 'Close',
    limitContactEmail: 'contact@cdc.org.ge',
  },
};

function CertificatesContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { user } = useAuth();

  const [courses, setCourses] = useState<MyCourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingCourseId, setDownloadingCourseId] = useState<string | null>(null);
  const [confirmCourseId, setConfirmCourseId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [limitReachedMessage, setLimitReachedMessage] = useState<string | null>(null);

  useEscapeToClose(confirmCourseId !== null, () => setConfirmCourseId(null));
  useEscapeToClose(limitReachedMessage !== null, () => setLimitReachedMessage(null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await getMyCourses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const certificateNameKa =
    user?.legalFirstNameKa && user?.legalLastNameKa ? `${user.legalFirstNameKa} ${user.legalLastNameKa}` : user?.name ?? '';
  const certificateNameEn =
    user?.legalFirstNameEn && user?.legalLastNameEn ? `${user.legalFirstNameEn} ${user.legalLastNameEn}` : null;

  const handleDownloadCertificate = async (courseId: string, verificationCode: string | null) => {
    setDownloadingCourseId(courseId);
    setDownloadError(null);
    try {
      const blob = await downloadCertificate(courseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CDC-Certificate-${verificationCode ?? courseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setConfirmCourseId(null);
    } catch (err: any) {
      // responseType: 'blob' means an error response's JSON body arrives as
      // a Blob too, not parsed data — err.response.data.message would be
      // undefined even when the server sent a real error message.
      const errorBlob = err?.response?.data;
      let serverMessage: string | undefined;
      let serverErrorKey: string | undefined;
      if (errorBlob instanceof Blob) {
        try {
          const parsed = JSON.parse(await errorBlob.text());
          serverMessage = parsed?.message;
          serverErrorKey = parsed?.error;
        } catch {
          // not JSON — ignore, fall back to the generic message below
        }
      }
      if (serverErrorKey === 'DOWNLOAD_LIMIT_REACHED') {
        setConfirmCourseId(null);
        setLimitReachedMessage(serverMessage ?? t.limitMessage);
      } else {
        setDownloadError(serverMessage || t.downloadFailed);
      }
    } finally {
      setDownloadingCourseId(null);
    }
  };

  const certified = courses.filter((c) => c.hasCertificate);
  const confirmEntry = certified.find((c) => c.course.id === confirmCourseId) ?? null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-amber-500" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : certified.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
            <Link
              href="/courses"
              className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
            >
              {t.browseCourses}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {certified.map(({ course, certificateIssuedAt, verificationCode, certificateDownloadCount }) => (
              <div
                key={course.id}
                className="bg-white dark:bg-slate-900/60 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{course.title}</h3>
                    {certificateIssuedAt && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                        {t.issued}: {new Date(certificateIssuedAt).toLocaleDateString()}
                      </p>
                    )}
                    {verificationCode && (
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1 break-all">
                        {t.code}: {verificationCode}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {verificationCode && (
                      <Link
                        href={`/verify/${verificationCode}`}
                        target="_blank"
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t.verify}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (certificateDownloadCount >= 1) {
                          setLimitReachedMessage(t.limitMessage);
                          return;
                        }
                        setDownloadError(null);
                        setConfirmCourseId(course.id);
                      }}
                      disabled={downloadingCourseId === course.id}
                      className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      {downloadingCourseId === course.id ? t.generating : t.download}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmEntry && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmCourseId(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.confirmTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.confirmBody}</p>
            <p className="text-lg font-bold text-cyan-600 dark:text-cyan-300 mb-1">{certificateNameKa}</p>
            {certificateNameEn && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{certificateNameEn}</p>}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6">{t.confirmChangeHint}</p>
            {downloadError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{downloadError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDownloadCertificate(confirmEntry.course.id, confirmEntry.verificationCode)}
                disabled={downloadingCourseId === confirmEntry.course.id}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
              >
                {downloadingCourseId === confirmEntry.course.id ? t.generating : t.confirmDownload}
              </button>
              <Link
                href="/dashboard/settings"
                className="w-full text-center text-sm font-bold px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.confirmChangeName}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmCourseId(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {limitReachedMessage && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLimitReachedMessage(null)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3">{t.limitTitle}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{limitReachedMessage}</p>
            <div className="flex flex-col gap-2">
              <a
                href={`mailto:${t.limitContactEmail}`}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition no-underline"
              >
                <Mail className="w-4 h-4" />
                {t.limitContactEmail}
              </a>
              <button
                type="button"
                onClick={() => setLimitReachedMessage(null)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.limitClose}
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <ProtectedRoute>
      <CertificatesContent />
    </ProtectedRoute>
  );
}
