import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import BackButton from '../../src/components/common/BackButton';
import { CertificateVerification } from '../../src/types/lms';
import { verifyCertificate } from '../../src/services/courseService';

// ============================================================
// Public certificate verification card — reached by anyone scanning the QR
// code / opening the link printed on a certificate PDF (see
// Backend/src/services/certificateService.ts), for ANY course/student/
// certificate. Deliberately self-contained bilingual UI (ka/en), independent
// of the site-wide next-i18next locale routing: most visitors land here
// directly from a printed/shared link, never having chosen a site locale.
// ============================================================

type Lang = 'ka' | 'en';

// Static UI labels only — the certificate's own data (student/course/
// instructor/date) comes from the API response below, per-record, not from
// this dictionary.
const dict: Record<Lang, {
  title: string;
  loading: string;
  verified: string;
  verifiedSub: string;
  notFound: string;
  notFoundSub: string;
  student: string;
  course: string;
  instructor: string;
  issued: string;
  code: string;
  download: string;
  backHome: string;
}> = {
  ka: {
    title: 'სერტიფიკატის ვერიფიკაცია',
    loading: 'მოწმდება…',
    verified: 'ვერიფიცირებული სერტიფიკატი',
    verifiedSub: 'ეს სერტიფიკატი გაცემულია CDC — ციფრული პროფესიების ცენტრის მიერ.',
    notFound: 'სერტიფიკატი ვერ მოიძებნა',
    notFoundSub: 'ეს ვერიფიკაციის კოდი არასწორია ან სერტიფიკატი აღარ არსებობს.',
    student: 'სტუდენტი',
    course: 'დასრულებული კურსი',
    instructor: 'ლექტორი',
    issued: 'გაცემის თარიღი',
    code: 'ვერიფიკაციის კოდი',
    download: 'PDF-ის ჩამოტვირთვა',
    backHome: '← მთავარ გვერდზე',
  },
  en: {
    title: 'Certificate Verification',
    loading: 'Verifying…',
    verified: 'Verified Certificate',
    verifiedSub: 'This certificate is issued by CDC — Center for Digital Careers.',
    notFound: 'Certificate Not Found',
    notFoundSub: 'This verification code is invalid or the certificate no longer exists.',
    student: 'Student',
    course: 'Completed Course',
    instructor: 'Instructor / Mentor',
    issued: 'Issue Date',
    code: 'Verification Code',
    download: 'Download PDF',
    backHome: '← Back to home',
  },
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function VerifyCertificatePage() {
  const router = useRouter();
  const code = typeof router.query.code === 'string' ? router.query.code : null;

  // Starts 'ka' on every render (server and first client render must match,
  // or React throws a hydration-mismatch warning) — the effect below then
  // reconciles it against the URL param / browser language once mounted.
  const [lang, setLang] = useState<Lang>('ka');
  const t = dict[lang];

  // Priority, highest first: explicit ?lang= URL param > browser language >
  // default Georgian. Re-runs if the URL param itself changes (e.g. a link
  // shared with ?lang=en updates the toggle without a full reload).
  useEffect(() => {
    if (!router.isReady) return;
    const urlLang = typeof router.query.lang === 'string' ? router.query.lang.toLowerCase() : null;
    if (urlLang === 'en') {
      setLang('en');
      return;
    }
    if (urlLang === 'ka' || urlLang === 'ge') {
      setLang('ka');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) {
      setLang('en');
    }
  }, [router.isReady, router.query.lang]);

  const [data, setData] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setNotFound(false);
    try {
      setData(await verifyCertificate(code));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // Manual toggle always wins outright — updates the URL's ?lang= param too,
  // so the choice survives a refresh/share instead of reverting to
  // auto-detection.
  const toggleLang = () => {
    const next: Lang = lang === 'ka' ? 'en' : 'ka';
    setLang(next);
    router.replace({ pathname: router.pathname, query: { ...router.query, lang: next } }, undefined, { shallow: true });
  };

  const studentName = (lang === 'en' && data?.studentNameEn) || data?.studentName || '';
  const courseTitle = (lang === 'en' && data?.courseTitleEn) || data?.courseTitle || '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-16">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <div className="max-w-lg w-full">
        <BackButton fallbackHref="/" className="mb-4 text-slate-400 hover:text-slate-100" />
        {loading ? (
          <p className="text-center text-sm text-slate-400">{t.loading}</p>
        ) : notFound || !data ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mx-auto mb-4">✕</div>
            <h1 className="text-lg font-black text-white mb-2">{t.notFound}</h1>
            <p className="text-sm text-red-200/80">{t.notFoundSub}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 overflow-hidden">
            <div className="relative bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-b border-emerald-500/30 px-8 py-6 text-center">
              <button
                type="button"
                onClick={toggleLang}
                title={lang === 'ka' ? 'Switch to English' : 'ქართულ ენაზე გადართვა'}
                className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-slate-950/60 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <span aria-hidden="true">🌐</span>
                <span className={lang === 'ka' ? 'text-white' : 'text-emerald-200/50'}>GE</span>
                <span className="text-emerald-200/40">|</span>
                <span className={lang === 'en' ? 'text-white' : 'text-emerald-200/50'}>EN</span>
              </button>
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 text-white flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                ✓
              </div>
              <h1 className="text-lg font-black text-white">{t.verified}</h1>
              <p className="text-xs text-emerald-200/80 mt-1">{t.verifiedSub}</p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.student}</p>
                <p className="text-xl font-black text-white mt-1">{studentName}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.course}</p>
                <p className="text-base font-bold text-white mt-1">{courseTitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.instructor}</p>
                  <p className="text-sm text-slate-200 mt-1">{data.instructorName ?? 'CDC Faculty'}</p>
                  {data.instructorTitle && <p className="text-xs text-slate-500">{data.instructorTitle}</p>}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.issued}</p>
                  <p className="text-sm text-slate-200 mt-1">{new Date(data.issuedAt).toISOString().slice(0, 10)}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.code}</p>
                <p className="text-xs font-mono text-slate-400 mt-1 break-all">{data.verificationCode}</p>
              </div>
              <a
                href={`${API_BASE_URL}/courses/certificates/download/${data.verificationCode}`}
                className="block text-center rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-slate-950 font-bold text-sm px-6 py-3 no-underline hover:opacity-90 transition-opacity"
              >
                {t.download}
              </a>
            </div>
          </div>
        )}

        <Link href="/" className="block text-center mt-8 text-sm text-slate-400 hover:text-white no-underline">
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
