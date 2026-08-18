import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { FileText, ShieldCheck } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import { useEscapeToClose } from '../src/hooks/useEscapeToClose';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';
import { getMentors, getMentorSlots, mentorTitle, mentorBio, PublicMentor } from '../src/services/mentorshipService';
import { checkoutMentorship } from '../src/services/paymentService';
import { formatPrice } from '../src/utils/coursePricing';

function MentorAvatar({ mentor, size = 56 }: { mentor: PublicMentor; size?: number }) {
  return mentor.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mentor.avatarUrl}
      alt={mentor.name}
      className="rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black shrink-0"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {mentor.name.charAt(0).toUpperCase()}
    </div>
  );
}

function BookingModal({ mentor, lang, onClose }: { mentor: PublicMentor; lang: 'ka' | 'en'; onClose: () => void }) {
  const { t } = useTranslation('mentorship');
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(true, onClose);

  useEffect(() => {
    getMentorSlots(mentor.id)
      .then(setSlots)
      .finally(() => setLoadingSlots(false));
  }, [mentor.id]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots) {
      const dateKey = new Date(iso).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(iso);
    }
    return map;
  }, [slots, lang]);

  const dateKeys = Array.from(slotsByDate.keys());

  useEffect(() => {
    if (!selectedDate && dateKeys.length > 0) setSelectedDate(dateKeys[0]);
  }, [dateKeys, selectedDate]);

  const handlePay = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const { redirectUrl } = await checkoutMentorship({
        mentorId: mentor.id,
        scheduledAt: selectedSlot,
        studentPhone: phone.trim(),
        consultationDescription: topic.trim() || undefined,
        lang,
      });
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.response?.data?.message || t('bookingError'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <MentorAvatar mentor={mentor} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{mentor.name}</p>
            {mentorTitle(mentor, lang) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{mentorTitle(mentor, lang)}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {mentor.mentorHourlyRate != null && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatPrice(mentor.mentorHourlyRate)} {t('perHour')}
                </p>
              )}
              {mentor.mentorLanguages.length > 0 && (
                <p className="text-[11px] text-slate-400">🗣️ {mentor.mentorLanguages.join(', ')}</p>
              )}
            </div>
          </div>
          {mentor.cvUrl && (
            <a
              href={mentor.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FileText className="w-3.5 h-3.5" />
              {'რეზიუმე / CV'}
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`${mentor.cvUrl ? '' : 'ml-auto'} text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer`}
          >
            {t('close')}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t('step1Title')}</h3>
            {loadingSlots ? (
              <p className="text-sm text-slate-400">{t('loading')}</p>
            ) : dateKeys.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('bookingNoSlots')}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {dateKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedDate(key);
                        setSelectedSlot(null);
                      }}
                      className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                        selectedDate === key
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
                  {(selectedDate ? slotsByDate.get(selectedDate) ?? [] : []).map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedSlot(iso)}
                      className={`text-xs font-bold px-2 py-2 rounded-lg border transition-colors ${
                        selectedSlot === iso
                          ? 'border-cyan-500 bg-cyan-500 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {new Date(iso).toLocaleTimeString(lang === 'ka' ? 'ka-GE' : 'en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Tbilisi',
                      })}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedSlot}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm py-3 disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t('step2Title')}</h3>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2.5 text-sm mb-4"
              placeholder="+995 5xx xxx xxx"
            />
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('topicFieldLabel')}</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={t('topicPlaceholder') as string}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2.5 text-sm mb-5"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm py-3"
              >
                {t('back')}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={phone.trim().length < 5}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm py-3 disabled:opacity-40"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedSlot && (
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t('step3Title')}</h3>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 text-sm space-y-1.5 mb-5">
              <p className="text-slate-800 dark:text-slate-200 font-bold">
                {t('with')} {mentor.name}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {new Date(selectedSlot).toLocaleString(lang === 'ka' ? 'ka-GE' : 'en-GB', { timeZone: 'Asia/Tbilisi' })}
              </p>
              {mentor.mentorHourlyRate != null && (
                <p className="text-slate-600 dark:text-slate-400">{formatPrice(mentor.mentorHourlyRate)}</p>
              )}
            </div>

            <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 p-4 mb-5">
              <p className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-amber-300 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" /> {t('policyTitle')}
              </p>
              <ul className="space-y-1 text-[11px] text-amber-800/90 dark:text-amber-200/80 list-disc pl-4">
                <li>{t('policyPoint1')}</li>
                <li>{t('policyPoint2')}</li>
                <li>{t('policyPoint3')}</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm py-3 disabled:opacity-40"
              >
                {t('back')}
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={submitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm py-3 disabled:opacity-60"
              >
                {submitting ? t('processing') : t('payNow')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MentorCard({ mentor, lang, onBook }: { mentor: PublicMentor; lang: 'ka' | 'en'; onBook: () => void }) {
  const { t } = useTranslation('mentorship');
  const title = mentorTitle(mentor, lang);
  const bio = mentorBio(mentor, lang);
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <MentorAvatar mentor={mentor} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{mentor.name}</p>
          {title && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{title}</p>}
        </div>
        {mentor.cvUrl && (
          <a
            href={mentor.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FileText className="w-3.5 h-3.5" />
            {'რეზიუმე / CV'}
          </a>
        )}
      </div>
      {bio && <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 line-clamp-3">{bio}</p>}
      {mentor.mentorLanguages.length > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">🗣️ {mentor.mentorLanguages.join(', ')}</p>
      )}
      {mentor.mentorSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {mentor.mentorSkills.map((skill) => (
            <span
              key={skill}
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span className="text-sm font-black text-cyan-600 dark:text-cyan-300">
          {mentor.mentorHourlyRate != null ? (
            <>
              {formatPrice(mentor.mentorHourlyRate)}
              <span className="text-xs font-normal text-slate-400"> {t('perHour')}</span>
            </>
          ) : (
            <span className="text-xs font-normal text-slate-400">{t('priceNotSet')}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onBook}
          disabled={mentor.mentorHourlyRate == null}
          className="text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('bookSession')}
        </button>
      </div>
    </div>
  );
}

export default function MentorsPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const { t } = useTranslation('mentorship');
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [mentors, setMentors] = useState<PublicMentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMentor, setBookingMentor] = useState<PublicMentor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMentors(await getMentors());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBook = (mentor: PublicMentor) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setBookingMentor(mentor);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t('mentorsTitle')} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-black mb-2">{t('mentorsTitle')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">{t('mentorsSubtitle')}</p>

        {loading ? (
          <p className="text-sm text-slate-400">{t('loading')}</p>
        ) : mentors.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('mentorsEmpty')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} lang={lang} onBook={() => handleBook(mentor)} />
            ))}
          </div>
        )}
      </div>
      <SiteFooter />

      {bookingMentor && <BookingModal mentor={bookingMentor} lang={lang} onClose={() => setBookingMentor(null)} />}
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['mentorship'])) },
});
