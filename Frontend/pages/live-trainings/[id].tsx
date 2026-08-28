import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Calendar, Users, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import VideoEmbed from '../../src/components/shared/VideoEmbed';
import { LiveTraining } from '../../src/types/liveTraining';
import { getLiveTraining, registerForLiveTraining, enrollInLiveTraining } from '../../src/services/liveTrainingService';
import { resolveLocale } from '@/src/utils/locale';
import { courseLanguageBadge } from '@/src/utils/courseLanguage';
import { useAuth } from '../../src/context/AuthContext';

const EN_STRINGS = {
  loading: 'Loading…',
  notFound: 'This live training could not be found.',
  seatsRemaining: (n: number, total: number) => `${n} seats left of ${total} registered`,
  registeredOf: (n: number, total: number) => `${n} / ${total} registered`,
  full: 'Fully Booked',
  minMet: 'Minimum group reached — this session is confirmed to run',
  minNotMet: (n: number, min: number) => `${n} more needed to reach the minimum group of ${min}`,
  nameLabel: 'Full name',
  emailLabel: 'Email',
  phoneLabel: 'Phone number',
  register: 'Register',
  registering: 'Registering…',
  success: 'Thanks! We\'ll call you shortly to confirm your spot.',
  genericError: 'Registration failed. Please try again.',
  free: 'Free',
  enroll: 'Enroll — I have an account',
  enrolling: 'Enrolling…',
  enrollSuccess: 'You\'re enrolled! Find the join link and recording on your dashboard closer to the session.',
  goToDashboard: 'Go to My Live Trainings',
  orDivider: 'or',
};

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'ტრენინგი ვერ მოიძებნა.',
    seatsRemaining: (n: number, total: number) => `დარჩენილია ${n} ადგილი ${total}-დან`,
    registeredOf: (n: number, total: number) => `${n} / ${total} დარეგისტრირებულია`,
    full: 'ადგილები შევსებულია',
    minMet: 'მინიმალური ჯგუფი შევსებულია — სესია დადასტურებულია',
    // Explicitly names the minimum-group threshold (a separate, usually
    // much smaller number from maxCapacity/room size above) — without it,
    // "აკლია 3" read next to "0 / 15" looked like a contradiction, when
    // it's actually two independent thresholds (e.g. "need 3 to run the
    // session" vs. "room holds 15") both correctly derived from the same
    // live registeredCount.
    minNotMet: (n: number, min: number) => `მინიმალური ${min}-კაციანი ჯგუფისთვის აკლია ${n} ადამიანი`,
    nameLabel: 'სახელი და გვარი',
    emailLabel: 'ელ. ფოსტა',
    phoneLabel: 'ტელეფონის ნომერი',
    register: 'რეგისტრაცია',
    registering: 'იგზავნება…',
    success: 'გმადლობთ! მალე დაგირეკავთ ადგილის დასადასტურებლად.',
    genericError: 'რეგისტრაცია ვერ მოხერხდა. სცადეთ თავიდან.',
    free: 'უფასო',
    enroll: 'ჩარიცხვა — მაქვს ანგარიში',
    enrolling: 'ჩარიცხვა მიმდინარეობს…',
    enrollSuccess: 'თქვენ ჩარიცხული ხართ! მიერთების ბმული და ჩანაწერი სესიასთან ახლოს დაშბორდზე გამოჩნდება.',
    goToDashboard: 'ჩემი ლაივ ტრენინგები',
    orDivider: 'ან',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

export default function LiveTrainingDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const contentLang = lang === 'ka' ? 'ka' : 'en';
  const { isAuthenticated } = useAuth();

  const [training, setTraining] = useState<LiveTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setTraining(await getLiveTraining(id));
    } catch {
      setTraining(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await registerForLiveTraining(id, { name: name.trim(), email: email.trim(), phone: phone.trim() });
      setSuccess(true);
      load(); // refresh capacity counters
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!id) return;
    setEnrollError(null);
    setEnrolling(true);
    try {
      await enrollInLiveTraining(id);
      setEnrolled(true);
      load(); // refresh capacity counters
    } catch (err: any) {
      // "already enrolled" is functionally the same outcome as a fresh
      // success from this button's point of view — no reason to surface it
      // as an error.
      if (err?.response?.status === 400 && err.response.data?.message?.includes('already enrolled')) {
        setEnrolled(true);
      } else {
        setEnrollError(err?.response?.data?.message ?? t.genericError);
      }
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
        <SiteHeader />
        <p className="text-slate-400 text-sm max-w-3xl mx-auto">{t.loading}</p>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
        <SiteHeader />
        <p className="text-slate-400 text-sm max-w-3xl mx-auto">{t.notFound}</p>
      </div>
    );
  }

  const title = (contentLang === 'en' && training.titleEn) || training.title;
  const description = (contentLang === 'en' && training.descriptionEn) || training.description;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/live-trainings" className="text-slate-400 hover:text-slate-100" />
        </div>

        {training.thumbnailUrl && (
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-slate-900 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={training.thumbnailUrl} alt={title} className="w-full h-full object-cover object-center" />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20 inline-block">
            {training.category}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-slate-300 bg-slate-500/10 border-slate-500/20 inline-block">
            {courseLanguageBadge(training.language, lang === 'ka' ? 'ka' : 'en')}
          </span>
        </div>
        <h1 className="blog-heading-safe text-3xl font-black mb-3">{title}</h1>
        <p className="text-slate-400 leading-relaxed mb-6 whitespace-pre-line">{description}</p>

        {training.videoUrl && (
          <div className="mb-6">
            <VideoEmbed url={training.videoUrl} title={title} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-slate-300">
          <span className="flex items-center gap-1.5">
            <Calendar size={15} className="text-cyan-400" />
            {new Date(training.scheduledAt).toLocaleString()}
          </span>
          <span className="font-bold text-cyan-400">
            {training.price ? `${(training.price / 100).toFixed(2)} ₾` : t.free}
          </span>
        </div>

        {/* Capacity block — seat counter, min-threshold badge, and the
            auto-cap that disables the form once isFull flips true (derived
            server-side from the live lead count, see liveTrainingService.ts). */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className={`flex items-center gap-1.5 text-sm font-bold ${training.isFull ? 'text-red-400' : 'text-cyan-400'}`}>
              <Users size={15} />
              {training.isFull ? t.full : t.seatsRemaining(training.seatsRemaining, training.maxCapacity)}
            </span>
            <span className="text-xs text-slate-500">{t.registeredOf(training.registeredCount, training.maxCapacity)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full ${training.isFull ? 'bg-red-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, (training.registeredCount / training.maxCapacity) * 100)}%` }}
            />
          </div>
          {training.minCapacity > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                training.minThresholdMet
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              }`}
            >
              {training.minThresholdMet ? <CheckCircle2 size={12} /> : null}
              {training.minThresholdMet
                ? t.minMet
                : t.minNotMet(Math.max(0, training.minCapacity - training.registeredCount), training.minCapacity)}
            </span>
          )}
        </div>

        {success || enrolled ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={28} />
            <p className="text-sm text-emerald-300">{enrolled ? t.enrollSuccess : t.success}</p>
            {enrolled && (
              <Link
                href="/dashboard/live-trainings"
                className="inline-block mt-4 text-xs font-bold px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 no-underline"
              >
                {t.goToDashboard}
              </Link>
            )}
          </div>
        ) : training.isFull ? (
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-bold text-slate-500 cursor-not-allowed"
          >
            {t.full}
          </button>
        ) : (
          <>
            {isAuthenticated && (
              <div className="mb-4">
                {enrollError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300 mb-3">{enrollError}</div>
                )}
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {enrolling ? t.enrolling : t.enroll}
                </button>
                <div className="flex items-center gap-3 my-4 text-slate-600 text-xs">
                  <div className="flex-1 h-px bg-slate-800" />
                  {t.orDivider}
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.nameLabel}</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.emailLabel}</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.phoneLabel}</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+995 5XX XX XX XX"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? t.registering : t.register}
            </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
