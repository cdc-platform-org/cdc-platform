import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Calendar, Wallet, Settings, Plus, Trash2, ArrowRight } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import {
  getMyMentorProfile,
  updateMyMentorProfile,
  getMyAvailability,
  createMyAvailabilityRule,
  deleteMyAvailabilityRule,
  MentorProfile,
  MentorAvailabilityRuleRow,
} from '../../src/services/mentorshipService';
import { getWalletSummary, createPayoutRequest, getMyPayoutRequests, WalletSummary, PayoutRequestRow } from '../../src/services/walletService';

const DAYS_KA = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dict = {
  ka: {
    title: 'მენტორის სამუშაო სივრცე',
    sessionsLink: 'ჩემი სესიები',
    sessionsHint: 'დაჯავშნილი სესიების სია, კალენდარი და ჩართვის ბმულების მართვა',
    rateTitle: 'საათობრივი ტარიფი და პროფილი',
    hourlyRate: 'საათობრივი ტარიფი (₾)',
    title2: 'თანამდებობა / სპეციალობა',
    save: 'შენახვა',
    saving: 'ინახება…',
    saved: 'შენახულია ✓',
    availabilityTitle: 'ხელმისაწვდომობის განრიგი',
    availabilityHint: 'დაამატეთ დროის შუალედები, როდესაც სტუდენტებს შეუძლიათ სესიის დაჯავშნა.',
    addSlot: 'შუალედის დამატება',
    day: 'დღე',
    from: 'დან',
    to: 'მდე',
    noSlots: 'ჯერ არცერთი ხელმისაწვდომობის შუალედი არ გაქვთ დამატებული.',
    earningsTitle: 'შემოსავალი და გატანა',
    availableBalance: 'ხელმისაწვდომი ბალანსი',
    requestPayout: 'თანხის გატანა',
    amount: 'თანხა (₾)',
    iban: 'IBAN',
    ibanHint: 'ცარიელი დატოვეთ, პროფილში შენახული IBAN-ის გამოსაყენებლად.',
    submit: 'მოთხოვნის გაგზავნა',
    submitting: 'იგზავნება…',
    payoutHistory: 'გატანის ისტორია',
    noPayouts: 'ჯერ არცერთი მოთხოვნა არ გაქვთ.',
    error: 'შეცდომა დაფიქსირდა. სცადეთ ხელახლა.',
  },
  en: {
    title: 'Mentor Workspace',
    sessionsLink: 'My Sessions',
    sessionsHint: 'Booked session list, calendar, and meeting-link management',
    rateTitle: 'Hourly Rate & Profile',
    hourlyRate: 'Hourly Rate (₾)',
    title2: 'Title / Specialty',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved ✓',
    availabilityTitle: 'Availability Schedule',
    availabilityHint: 'Add time slots when students can book a session with you.',
    addSlot: 'Add Slot',
    day: 'Day',
    from: 'From',
    to: 'To',
    noSlots: "You haven't added any availability slots yet.",
    earningsTitle: 'Earnings & Withdrawal',
    availableBalance: 'Available Balance',
    requestPayout: 'Request a Payout',
    amount: 'Amount (₾)',
    iban: 'IBAN',
    ibanHint: 'Leave blank to use the IBAN saved in your account settings.',
    submit: 'Submit Request',
    submitting: 'Submitting…',
    payoutHistory: 'Payout History',
    noPayouts: 'No payout requests yet.',
    error: 'Something went wrong. Please try again.',
  },
} as const;

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function MentorshipWorkspaceContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const days = lang === 'en' ? DAYS_EN : DAYS_KA;

  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [rules, setRules] = useState<MentorAvailabilityRuleRow[]>([]);
  const [newDay, setNewDay] = useState(1);
  const [newFrom, setNewFrom] = useState('18:00');
  const [newTo, setNewTo] = useState('21:00');
  const [addingRule, setAddingRule] = useState(false);

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyMentorProfile().then((p) => {
      setProfile(p);
      setRateInput(p.mentorHourlyRate != null ? String(p.mentorHourlyRate / 100) : '');
      setTitleInput((lang === 'en' && p.mentorTitleEn) || p.mentorTitle || '');
    }).catch(() => {});
    getMyAvailability().then(setRules).catch(() => {});
    getWalletSummary().then(setWallet).catch(() => {});
    getMyPayoutRequests().then(setPayoutRequests).catch(() => {});
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    setProfileSaved(false);
    try {
      const rateMinor = Math.round((Number(rateInput) || 0) * 100);
      const updated = await updateMyMentorProfile(
        lang === 'en' ? { mentorHourlyRate: rateMinor, mentorTitleEn: titleInput } : { mentorHourlyRate: rateMinor, mentorTitle: titleInput }
      );
      setProfile(updated);
      setProfileSaved(true);
    } catch {
      setError(t.error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddRule = async () => {
    setAddingRule(true);
    setError(null);
    try {
      const rule = await createMyAvailabilityRule({ dayOfWeek: newDay, startMinute: timeToMinutes(newFrom), endMinute: timeToMinutes(newTo) });
      setRules((prev) => [...prev, rule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute));
    } catch {
      setError(t.error);
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    try {
      await deleteMyAvailabilityRule(ruleId);
    } catch {
      setError(t.error);
      load();
    }
  };

  const handleRequestPayout = async () => {
    setSubmittingPayout(true);
    setError(null);
    try {
      const amountMinor = Math.round((Number(payoutAmount) || 0) * 100);
      await createPayoutRequest(amountMinor, payoutIban || undefined);
      setPayoutAmount('');
      setPayoutIban('');
      getWalletSummary().then(setWallet).catch(() => {});
      getMyPayoutRequests().then(setPayoutRequests).catch(() => {});
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.error);
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <BackButton fallbackHref="/" className="mb-4" />
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">{t.title}</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
        )}

        <Link
          href="/dashboard/mentorship-sessions"
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6 no-underline text-current hover:border-cyan-400/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-500" />
            <div>
              <p className="font-bold text-sm">{t.sessionsLink}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.sessionsHint}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </Link>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> {t.rateTitle}</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.hourlyRate}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.title2}</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white disabled:opacity-60"
          >
            {savingProfile ? t.saving : profileSaved ? t.saved : t.save}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-bold mb-1">{t.availabilityTitle}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.availabilityHint}</p>

          {rules.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noSlots}</p>
          ) : (
            <div className="space-y-2 mb-4">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5">
                  <span className="text-sm">
                    {days[rule.dayOfWeek]}, {minutesToTime(rule.startMinute)}–{minutesToTime(rule.endMinute)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    aria-label="Delete"
                    className="text-slate-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.day}</label>
              <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm">
                {days.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.from}</label>
              <input type="time" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.to}</label>
              <input type="time" value={newTo} onChange={(e) => setNewTo(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm" />
            </div>
            <button
              type="button"
              onClick={handleAddRule}
              disabled={addingRule}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" /> {t.addSlot}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> {t.earningsTitle}</h2>
          <div className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 p-5 text-white mb-5">
            <p className="text-xs opacity-80 mb-1">{t.availableBalance}</p>
            <p className="text-2xl font-black">{((wallet?.earningsBalance ?? 0) / 100).toFixed(2)} ₾</p>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t.requestPayout}</h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t.amount}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              placeholder={t.iban}
              value={payoutIban}
              onChange={(e) => setPayoutIban(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">{t.ibanHint}</p>
          <button
            type="button"
            onClick={handleRequestPayout}
            disabled={submittingPayout || !payoutAmount}
            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white disabled:opacity-60 mb-6"
          >
            {submittingPayout ? t.submitting : t.submit}
          </button>

          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t.payoutHistory}</h3>
          {payoutRequests.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.noPayouts}</p>
          ) : (
            <div className="space-y-2">
              {payoutRequests.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs">
                  <span>{(p.amount / 100).toFixed(2)} ₾ — {p.iban}</span>
                  <span className="font-bold uppercase">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}

export default function MentorshipWorkspacePage() {
  return (
    <ProtectedRoute>
      <RoleGate
        allowedRoles={['Mentor']}
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
            This page is available only to Mentor accounts.
          </div>
        }
      >
        <MentorshipWorkspaceContent />
      </RoleGate>
    </ProtectedRoute>
  );
}
