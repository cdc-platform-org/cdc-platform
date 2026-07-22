import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { CertificateVerification } from '../../src/types/lms';
import { verifyCertificate } from '../../src/services/courseService';

const dict = {
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
    backHome: '← მთავარ გვერდზე',
  },
  en: {
    title: 'Certificate Verification',
    loading: 'Verifying…',
    verified: 'Verified Certificate',
    verifiedSub: 'This certificate was issued by CDC — Center for Digital Careers.',
    notFound: 'Certificate Not Found',
    notFoundSub: 'This verification code is invalid or the certificate no longer exists.',
    student: 'Student',
    course: 'Course Completed',
    instructor: 'Instructor',
    issued: 'Issue Date',
    code: 'Verification Code',
    backHome: '← Back to home',
  },
};

export default function VerifyCertificatePage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const code = typeof router.query.code === 'string' ? router.query.code : null;

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-16">
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-lg w-full">
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
            <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-b border-emerald-500/30 px-8 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 text-white flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                ✓
              </div>
              <h1 className="text-lg font-black text-white">{t.verified}</h1>
              <p className="text-xs text-emerald-200/80 mt-1">{t.verifiedSub}</p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.student}</p>
                <p className="text-xl font-black text-white mt-1">{data.studentName}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.course}</p>
                <p className="text-base font-bold text-white mt-1">{data.courseTitle}</p>
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
