import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { TeamMember } from '../../src/types/teamMember';
import { getTrainers } from '../../src/services/teamMemberService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';

const dict = {
  ka: {
    title: 'ჩვენი ტრენერები',
    subtitle: 'გაიცანით CDC-ის ტრენერები — პრაქტიკოსები, რომლებიც გასწავლიან რეალურ, ინდუსტრიაში მოთხოვნად უნარებს.',
    loading: 'იტვირთება…',
    empty: 'ტრენერები მალე დაემატება.',
    viewCourses: 'კურსების ნახვა →',
  },
  en: {
    title: 'Our Trainers',
    subtitle: 'Meet the CDC trainers — practitioners who teach real, industry-demanded skills.',
    loading: 'Loading…',
    empty: 'Trainers will be added soon.',
    viewCourses: 'View Courses →',
  },
};

export default function TrainersPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrainers(await getTrainers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-6 py-16 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-2xl">{t.subtitle}</p>

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        ) : trainers.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainers.map((trainer) => (
              <div
                key={trainer.id}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]"
              >
                {trainer.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={trainer.imageUrl}
                    alt={trainer.name}
                    onError={onImageErrorFallback}
                    className="w-20 h-20 rounded-full mx-auto mb-5 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                    {trainer.name
                      .split(' ')
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
                <h3 className="font-black text-lg text-center mb-1">{trainer.name}</h3>
                <span className="text-[11px] text-cyan-500 font-bold block mb-4 uppercase tracking-wider text-center">{trainer.role}</span>
                {trainer.bio && <p className="text-sm text-slate-400 leading-relaxed font-medium text-center">{trainer.bio}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-14">
          <Link
            href="/courses"
            className="inline-block px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest border border-cyan-500 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all duration-300 hover:scale-105"
          >
            {t.viewCourses}
          </Link>
        </div>
      </div>
      <SiteFooter lang={lang === 'en' ? 'ENG' : 'GEO'} />
    </div>
  );
}
