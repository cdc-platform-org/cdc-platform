import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Calendar, Users } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import { LiveTraining } from '../../src/types/liveTraining';
import { getLiveTrainings } from '../../src/services/liveTrainingService';
import { resolveLocale } from '@/src/utils/locale';

const EN_STRINGS = {
  title: 'Live Trainings',
  subtitle: 'Scheduled live workshops — register your spot, we\'ll call you to confirm.',
  loading: 'Loading…',
  empty: 'No live trainings are scheduled right now.',
  seatsRemaining: (n: number, total: number) => `${n} seats left of ${total}`,
  full: 'Fully booked',
  register: 'Register',
};

const dict = {
  ka: {
    title: 'ლაივ ტრენინგები',
    subtitle: 'დაგეგმილი ლაივ ვორქშოფები — დარეგისტრირდით, ჩვენ დაგირეკავთ დასადასტურებლად.',
    loading: 'იტვირთება…',
    empty: 'ამჟამად დაგეგმილი ტრენინგი არ არის.',
    seatsRemaining: (n: number, total: number) => `დარჩენილია ${n} ადგილი ${total}-დან`,
    full: 'ადგილები შევსებულია',
    register: 'რეგისტრაცია',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

export default function LiveTrainingsIndexPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const contentLang = lang === 'ka' ? 'ka' : 'en';

  const [trainings, setTrainings] = useState<LiveTraining[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLiveTrainings();
      setTrainings(data.filter((tr) => tr.published));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="text-slate-400 hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : trainings.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainings.map((tr) => (
              <Link
                key={tr.id}
                href={`/live-trainings/${tr.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] no-underline text-current"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20 self-start mb-4">
                    {tr.category}
                  </span>
                  <h3 className="text-lg font-black mb-2 text-white line-clamp-2 break-words">
                    {(contentLang === 'en' && tr.titleEn) || tr.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-4 flex-1">
                    {(contentLang === 'en' && tr.descriptionEn) || tr.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                    <Calendar size={12} />
                    {new Date(tr.scheduledAt).toLocaleString()}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${tr.isFull ? 'text-red-400' : 'text-cyan-400'}`}>
                    <Users size={12} />
                    {tr.isFull ? t.full : t.seatsRemaining(tr.seatsRemaining, tr.maxCapacity)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
