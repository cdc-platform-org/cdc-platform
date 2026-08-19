import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Calendar, Wallet, Settings, Plus, Trash2, ArrowRight, CalendarOff } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import {
  getMyMentorProfile,
  getMyAvailability,
  createMyAvailabilityRule,
  deleteMyAvailabilityRule,
  getMyAvailabilityExceptions,
  createMyAvailabilityException,
  deleteMyAvailabilityException,
  MentorProfile,
  MentorAvailabilityRuleRow,
  MentorAvailabilityException,
} from '../../src/services/mentorshipService';
import { getWalletSummary, createPayoutRequest, getMyPayoutRequests, WalletSummary, PayoutRequestRow } from '../../src/services/walletService';
import { resolveLocale } from '@/src/utils/locale';

const DAYS_KA = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const lang = resolveLocale(router.locale);
  const { t } = useTranslation('mentorship');
  const days = lang === 'en' ? DAYS_EN : DAYS_KA;

  const [profile, setProfile] = useState<MentorProfile | null>(null);

  const [rules, setRules] = useState<MentorAvailabilityRuleRow[]>([]);
  const [newDay, setNewDay] = useState(1);
  const [newFrom, setNewFrom] = useState('18:00');
  const [newTo, setNewTo] = useState('21:00');
  const [addingRule, setAddingRule] = useState(false);

  const [exceptions, setExceptions] = useState<MentorAvailabilityException[]>([]);
  const [newExceptionDate, setNewExceptionDate] = useState('');
  const [newExceptionReason, setNewExceptionReason] = useState('');
  const [addingException, setAddingException] = useState(false);

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyMentorProfile().then(setProfile).catch(() => {});
    getMyAvailability().then(setRules).catch(() => {});
    getMyAvailabilityExceptions().then(setExceptions).catch(() => {});
    getWalletSummary().then(setWallet).catch(() => {});
    getMyPayoutRequests().then(setPayoutRequests).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddRule = async () => {
    setAddingRule(true);
    setError(null);
    try {
      const rule = await createMyAvailabilityRule({ dayOfWeek: newDay, startMinute: timeToMinutes(newFrom), endMinute: timeToMinutes(newTo) });
      setRules((prev) => [...prev, rule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute));
    } catch {
      setError(t('workspaceError'));
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    try {
      await deleteMyAvailabilityRule(ruleId);
    } catch {
      setError(t('workspaceError'));
      load();
    }
  };

  const handleAddException = async () => {
    if (!newExceptionDate) return;
    setAddingException(true);
    setError(null);
    try {
      const exception = await createMyAvailabilityException(newExceptionDate, newExceptionReason.trim() || undefined);
      setExceptions((prev) => [...prev, exception].sort((a, b) => a.date.localeCompare(b.date)));
      setNewExceptionDate('');
      setNewExceptionReason('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('workspaceError'));
    } finally {
      setAddingException(false);
    }
  };

  const handleDeleteException = async (exceptionId: string) => {
    setExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
    try {
      await deleteMyAvailabilityException(exceptionId);
    } catch {
      setError(t('workspaceError'));
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
      setError(err?.response?.data?.message ?? t('workspaceError'));
    } finally {
      setSubmittingPayout(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <BackButton fallbackHref="/" className="mb-4" />
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">{t('workspaceTitle')}</h1>

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
              <p className="font-bold text-sm">{t('sessionsLink')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('sessionsHint')}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </Link>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> {t('rateTitle')}</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('hourlyRate')}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {profile?.mentorHourlyRate != null ? `${(profile.mentorHourlyRate / 100).toFixed(2)} ₾` : t('notSet')}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('title2')}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {(lang === 'en' && profile?.mentorTitleEn) || profile?.mentorTitle || t('notSet')}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('profileManagedByAdmin')}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-bold mb-1">{t('availabilityTitle')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('availabilityHint')}</p>

          {rules.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('availabilityNoSlots')}</p>
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('day')}</label>
              <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm">
                {days.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('from')}</label>
              <input type="time" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('to')}</label>
              <input type="time" value={newTo} onChange={(e) => setNewTo(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm" />
            </div>
            <button
              type="button"
              onClick={handleAddRule}
              disabled={addingRule}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" /> {t('addSlot')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-bold mb-1 flex items-center gap-2"><CalendarOff className="w-4 h-4" /> {t('exceptionsTitle')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('exceptionsHint')}</p>

          {exceptions.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('exceptionsNoDays')}</p>
          ) : (
            <div className="space-y-2 mb-4">
              {exceptions.map((exception) => (
                <div key={exception.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5">
                  <span className="text-sm">
                    {new Date(exception.date).toLocaleDateString()}
                    {exception.reason && <span className="text-slate-400 dark:text-slate-500"> — {exception.reason}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteException(exception.id)}
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('day')}</label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={newExceptionDate}
                onChange={(e) => setNewExceptionDate(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">&nbsp;</label>
              <input
                type="text"
                placeholder={t('exceptionReasonPlaceholder') as string}
                value={newExceptionReason}
                onChange={(e) => setNewExceptionReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddException}
              disabled={addingException || !newExceptionDate}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" /> {t('addException')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> {t('earningsTitle')}</h2>
          <div className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 p-5 text-white mb-5">
            <p className="text-xs opacity-80 mb-1">{t('availableBalance')}</p>
            <p className="text-2xl font-black">{((wallet?.earningsBalance ?? 0) / 100).toFixed(2)} ₾</p>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t('requestPayout')}</h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t('amount') as string}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              placeholder={t('iban') as string}
              value={payoutIban}
              onChange={(e) => setPayoutIban(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm"
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">{t('ibanHint')}</p>
          <button
            type="button"
            onClick={handleRequestPayout}
            disabled={submittingPayout || !payoutAmount}
            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white disabled:opacity-60 mb-6"
          >
            {submittingPayout ? t('submitting') : t('submit')}
          </button>

          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t('payoutHistory')}</h3>
          {payoutRequests.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('noPayouts')}</p>
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
      <SiteFooter />
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

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['mentorship'])) },
});
