import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QrCode, ShieldCheck, Calendar, UserCheck, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import api from '../../src/services/apiClient';
import { useAuth } from '../../src/context/AuthContext';

interface PassportData {
  passportCode: string;
  student: { name: string; role: string; isVerifiedGraduate: boolean; memberSince: string };
  stats: { coursesEvaluated: number; liveTrainingsAttended: number; certificatesIssued: number; averageReadiness: number };
  skills: string[];
  courseHistory: {
    id: string;
    courseTitle: string;
    category: string;
    mentorOrLecturer: string;
    evaluatedAt: string;
    totalScore: number;
    breakdown: { aiMentor: number; attendance: number; assignments: number; lecturer: number };
    passedThreshold: boolean;
  }[];
  liveTrainingHistory: { id: string; title: string; category: string; status: string; date: string }[];
  certificates: { id: string; code: string; courseTitle: string; issuedAt: string }[];
}

export default function StudentDigitalPassportPage() {
  const router = useRouter();
  const isKa = router.locale === 'ka';
  const [data, setData] = useState<PassportData | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [copied, setCopied] = useState(false);
  const { loading, isAuthenticated, user } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    let active = true;
    setData(null);
    setFailed(false);
    api.get('/passport/me').then((res) => { if (active) setData(res.data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [loading, isAuthenticated, user?.id]);

  const publicUrl =
    typeof window !== 'undefined' && data
      ? `${window.location.origin}/passport/${data.passportCode}`
      : '';

  const qrImageUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=0f172a&color=38bdf8&data=${encodeURIComponent(publicUrl)}`
    : '';

  const copyPassportLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>{isKa ? 'ციფრული პასპორტი | CDC Platform' : 'Digital Skill Passport | CDC Platform'}</title>
      </Head>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <SiteHeader />
        <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isKa ? 'ვერიფიცირებული აკადემიური იდენტობა' : 'Verified Academic Identity'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {isKa ? 'სტუდენტის ციფრული პასპორტი' : 'Student Digital Skill Passport'}
              </h1>
            </div>
            {data && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white cursor-pointer border-none"
                >
                  <QrCode className="w-4 h-4" />
                  {isKa ? (showQr ? 'QR კოდის დამალვა' : 'QR კოდის გენერირება') : 'Toggle QR Code'}
                </button>
                <button
                  type="button"
                  onClick={copyPassportLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? (isKa ? 'დაკოპირდა' : 'Copied') : (isKa ? 'ბმულის კოპირება' : 'Copy Link')}
                </button>
              </div>
            )}
          </div>

          {!data && <p role="status">{failed ? (isKa ? 'პასპორტის ჩატვირთვა ვერ მოხერხდა.' : 'Unable to load your passport. Please reload to try again.') : (isKa ? 'იტვირთება...' : 'Loading passport...')}</p>}
          {data && (
            <>
              <div className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 via-[#0b192c] to-slate-950 p-6 sm:p-8 shadow-[0_25px_80px_rgba(6,182,212,0.16)]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-8 space-y-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">CDC DIGITAL PASSPORT</p>
                        <p className="font-mono text-xs text-slate-400 mt-0.5">{data.passportCode}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-[11px] font-bold text-emerald-300">
                        {data.student.isVerifiedGraduate
                          ? (isKa ? '✓ ვერიფიცირებული კურსდამთავრებული' : '✓ Verified Graduate')
                          : (isKa ? '● აქტიური სტუდენტი' : '● Active Student')}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400">{isKa ? 'მფლობელი' : 'Holder'}</p>
                      <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">{data.student.name}</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                        <p className="text-[11px] text-slate-400">{isKa ? 'შეფასებული კურსი' : 'Courses'}</p>
                        <p className="text-xl font-black text-cyan-300 mt-0.5">{data.stats.coursesEvaluated}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                        <p className="text-[11px] text-slate-400">{isKa ? 'Live ტრენინგი' : 'Live Cohorts'}</p>
                        <p className="text-xl font-black text-purple-300 mt-0.5">{data.stats.liveTrainingsAttended}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                        <p className="text-[11px] text-slate-400">{isKa ? 'საშუალო ქულა' : 'Avg Readiness'}</p>
                        <p className="text-xl font-black text-emerald-300 mt-0.5">{data.stats.averageReadiness}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                        <p className="text-[11px] text-slate-400">{isKa ? 'სერტიფიკატი' : 'Certificates'}</p>
                        <p className="text-xl font-black text-amber-300 mt-0.5">{data.stats.certificatesIssued}</p>
                      </div>
                    </div>

                    {data.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {data.skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-0.5 text-[11px] font-medium text-cyan-200">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {showQr && qrImageUrl && (
                    <div className="md:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-4 text-center space-y-2.5">
                      <img src={qrImageUrl} alt="Digital Passport QR" className="w-44 h-44 rounded-xl border border-cyan-400/30" />
                      <p className="text-[11px] text-slate-400">
                        {isKa ? 'დაასკანერე QR კოდი პასპორტის ვერიფიკაციისთვის' : 'Scan QR to verify authentic learning record'}
                      </p>
                      <Link
                        href={`/passport/${data.passportCode}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:underline"
                      >
                        {isKa ? 'საჯარო პასპორტის ნახვა' : 'Open Public Card'} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {data.certificates.length > 0 && <section className="space-y-3">
                <h3 className="text-lg font-black">{isKa ? 'სერტიფიკატები' : 'Certificates'}</h3>
                {data.certificates.map((certificate) => <Link key={certificate.id} href={`/verify/${encodeURIComponent(certificate.code)}`} className="block rounded-xl border border-slate-700 p-4 text-cyan-300 hover:underline">
                  {certificate.courseTitle} · {certificate.code}
                </Link>)}
              </section>}
              <section className="space-y-4">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  {isKa ? 'აკადემიური გამოცდილება და 4-კომპონენტიანი შეფასებები' : 'Academic Experience & 4-Pillar Records'}
                </h3>
                {data.courseHistory.length === 0 ? (
                  <p className="text-sm text-slate-400 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                    {isKa ? 'ჯერ არ გაქვს დასრულებული შეფასების დოკუმენტი.' : 'No evaluated courses recorded yet.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {data.courseHistory.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold">{item.category}</span>
                            <h4 className="text-base font-bold text-white">{item.courseTitle}</h4>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              item.passedThreshold
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isKa ? 'ჯამური შეფასება:' : 'Total:'} {item.totalScore}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-cyan-400" /> {isKa ? 'ვისთან:' : 'Mentor/Lecturer:'} <b className="text-slate-200">{item.mentorOrLecturer}</b></span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-cyan-400" /> {isKa ? 'როდის:' : 'Date:'} <b className="text-slate-200">{new Date(item.evaluatedAt).toLocaleDateString()}</b></span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5">AI მენტორი (25%): <b>{item.breakdown.aiMentor}%</b></div>
                          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5">დასწრება (25%): <b>{item.breakdown.attendance}%</b></div>
                          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5">დავალებები (25%): <b>{item.breakdown.assignments}%</b></div>
                          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5">ლექტორი (25%): <b>{item.breakdown.lecturer}%</b></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
        <SiteFooter />
      </div>
    </ProtectedRoute>
  );
}
