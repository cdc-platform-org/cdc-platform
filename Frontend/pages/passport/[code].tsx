import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ShieldCheck, UserCheck, Calendar } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import api from '../../src/services/api';

export default function PublicPassportVerificationPage() {
  const router = useRouter();
  const code = typeof router.query.code === 'string' ? router.query.code : '';
  const isKa = router.locale === 'ka';
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .get(`/passport/public/${encodeURIComponent(code)}`)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true));
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Head>
        <title>{`CDC Digital Passport ${code}`}</title>
      </Head>
      <SiteHeader />
      <main className="max-w-4xl mx-auto w-full px-4 py-12 flex-1 space-y-6">
        {notFound ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
            {isKa ? 'ციფრული პასპორტი ვერ მოიძებნა.' : 'Digital Passport not found.'}
          </div>
        ) : !data ? (
          <p className="text-center text-sm text-slate-400">{isKa ? 'იტვირთება ვერიფიცირებული პასპორტი...' : 'Verifying passport...'}</p>
        ) : (
          <div className="rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-slate-900 via-[#0b192c] to-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-cyan-400 font-black tracking-widest text-xs uppercase">
                <ShieldCheck className="w-5 h-5" /> CDC VERIFIED DIGITAL SKILL PASSPORT
              </div>
              <span className="font-mono text-xs text-slate-400">{data.passportCode}</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{data.student.name}</h1>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                {isKa ? '✓ ოფიციალურად დადასტურებული სასწავლო გამოცდილება' : '✓ Officially Verified Academic & Practical Record'}
              </p>
            </div>
            <div className="space-y-3">
              {data.courseHistory?.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white text-sm">{item.courseTitle}</h2>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-cyan-400" /> {item.mentorOrLecturer}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-cyan-400" /> {new Date(item.evaluatedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-black text-emerald-300">
                    {item.totalScore}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}