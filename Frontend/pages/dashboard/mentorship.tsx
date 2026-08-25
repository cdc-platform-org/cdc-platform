import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Calendar, Wallet, Settings, Plus, Trash2, ArrowRight, CalendarOff, Check, PlayCircle } from 'lucide-react';
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
// Same dayOfWeek values (0=Sunday..6=Saturday) as everywhere else in this
// app, just displayed Monday-first — a natural work-week reading order for
// the grid below.
const DAYS_SHORT_KA = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRID_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// The grid's cell granularity matches the backend's fixed session length
// (mentorAvailabilityService.ts's DEFAULT_SESSION_MINUTES = 60) — every
// bookable slot is exactly one hour, so a 1-hour cell can't misrepresent a
// mentor's actual availability the way a coarser one could.
const GRID_HOUR_START = 8;
const GRID_HOUR_END = 22; // last selectable start hour — that cell covers 22:00-23:00
const GRID_HOURS = Array.from({ length: GRID_HOUR_END - GRID_HOUR_START + 1 }, (_, i) => GRID_HOUR_START + i);

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// A day's rules -> which of GRID_HOURS are fully covered ("on"). A hour
// only counts as on if some rule covers the whole [hour, hour+1) span —
// this stays correct even for pre-existing rules whose boundaries don't
// align to whole hours (nothing in the old form enforced that).
function deriveDayGrid(dayRules: MentorAvailabilityRuleRow[]): boolean[] {
  return GRID_HOURS.map((hour) => {
    const start = hour * 60;
    const end = start + 60;
    return dayRules.some((r) => r.startMinute <= start && r.endMinute >= end);
  });
}

// The inverse — collapses a boolean-per-hour day back into the minimal set
// of contiguous [startMinute, endMinute) ranges the backend actually
// stores. Rebuilding fresh from the full day's grid on every toggle (rather
// than patching individual rules) means legacy non-hour-aligned rules get
// naturally normalized the first time a mentor touches that day.
function gridToRanges(dayGrid: boolean[]): { startMinute: number; endMinute: number }[] {
  const ranges: { startMinute: number; endMinute: number }[] = [];
  let i = 0;
  while (i < dayGrid.length) {
    if (!dayGrid[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < dayGrid.length && dayGrid[j]) j += 1;
    ranges.push({ startMinute: GRID_HOURS[i] * 60, endMinute: GRID_HOURS[j - 1] * 60 + 60 });
    i = j;
  }
  return ranges;
}

function MentorshipWorkspaceContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const { t } = useTranslation('mentorship');

  const [profile, setProfile] = useState<MentorProfile | null>(null);

  const [rules, setRules] = useState<MentorAvailabilityRuleRow[]>([]);
  // dayOfWeek -> boolean per GRID_HOURS index. The single source of truth
  // for what the grid renders — always updated optimistically on click, and
  // only ever re-derived wholesale from a fresh `rules` fetch on initial
  // load/rollback, never reactively off every `rules` change (that would
  // stomp a same-render-cycle optimistic toggle on a day whose debounced
  // sync hasn't landed yet).
  const [grid, setGrid] = useState<Record<number, boolean[]>>({});
  const [savingDays, setSavingDays] = useState<Set<number>>(new Set());
  const [savedDays, setSavedDays] = useState<Set<number>>(new Set());
  const [gridError, setGridError] = useState<string | null>(null);
  const syncTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const savedFlashTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const [exceptions, setExceptions] = useState<MentorAvailabilityException[]>([]);
  const [newExceptionDate, setNewExceptionDate] = useState('');
  const [newExceptionReason, setNewExceptionReason] = useState('');
  const [blockWholeDay, setBlockWholeDay] = useState(true);
  const [newExceptionFrom, setNewExceptionFrom] = useState('18:00');
  const [newExceptionTo, setNewExceptionTo] = useState('21:00');
  const [addingException, setAddingException] = useState(false);

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(() => {
    getMyAvailability().then((fetched) => {
      setRules(fetched);
      const g: Record<number, boolean[]> = {};
      for (const day of GRID_DAY_ORDER) {
        g[day] = deriveDayGrid(fetched.filter((r) => r.dayOfWeek === day));
      }
      setGrid(g);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    getMyMentorProfile().then(setProfile).catch(() => {});
    loadRules();
    getMyAvailabilityExceptions().then(setExceptions).catch(() => {});
    getWalletSummary().then(setWallet).catch(() => {});
    getMyPayoutRequests().then(setPayoutRequests).catch(() => {});
  }, [loadRules]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced per-day sync — lets a mentor click several cells on the same
  // day in quick succession without firing a request per click, while the
  // cell color itself still updates instantly (see toggleCell below).
  const syncDay = useCallback(
    async (day: number, dayGrid: boolean[]) => {
      setSavingDays((prev) => new Set(prev).add(day));
      setGridError(null);
      const ranges = gridToRanges(dayGrid);
      const oldIds = rules.filter((r) => r.dayOfWeek === day).map((r) => r.id);
      try {
        const created = await Promise.all(ranges.map((range) => createMyAvailabilityRule({ dayOfWeek: day, ...range })));
        await Promise.all(oldIds.map((id) => deleteMyAvailabilityRule(id)));
        setRules((prev) => [...prev.filter((r) => r.dayOfWeek !== day), ...created]);
        setSavedDays((prev) => new Set(prev).add(day));
        if (savedFlashTimers.current[day]) clearTimeout(savedFlashTimers.current[day]);
        savedFlashTimers.current[day] = setTimeout(() => {
          setSavedDays((prev) => {
            const next = new Set(prev);
            next.delete(day);
            return next;
          });
        }, 2000);
      } catch {
        setGridError(t('gridSyncError'));
        // Roll back this day's cells to the last known-good server state —
        // every other day's grid (synced or still-pending) is untouched.
        setGrid((prev) => ({ ...prev, [day]: deriveDayGrid(rules.filter((r) => r.dayOfWeek === day)) }));
      } finally {
        setSavingDays((prev) => {
          const next = new Set(prev);
          next.delete(day);
          return next;
        });
      }
    },
    [rules, t]
  );

  const toggleCell = (day: number, hourIndex: number) => {
    setGrid((prev) => {
      const dayGrid = [...(prev[day] ?? GRID_HOURS.map(() => false))];
      dayGrid[hourIndex] = !dayGrid[hourIndex];
      const next = { ...prev, [day]: dayGrid };
      if (syncTimers.current[day]) clearTimeout(syncTimers.current[day]);
      syncTimers.current[day] = setTimeout(() => syncDay(day, dayGrid), 700);
      return next;
    });
  };

  const handleAddException = async () => {
    if (!newExceptionDate) return;
    setAddingException(true);
    setError(null);
    try {
      const timeRange = blockWholeDay
        ? undefined
        : { startMinute: timeToMinutes(newExceptionFrom), endMinute: timeToMinutes(newExceptionTo) };
      const exception = await createMyAvailabilityException(newExceptionDate, newExceptionReason.trim() || undefined, timeRange);
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

        <Link
          href="/dashboard/instructor-studio"
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-6 mb-6 no-underline text-current hover:border-cyan-400/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <PlayCircle className="w-6 h-6 text-cyan-500" />
            <div>
              <p className="font-bold text-sm">Instructor Studio</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create and manage your own video courses</p>
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
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h2 className="text-sm font-bold">{t('availabilityTitle')}</h2>
            {(savingDays.size > 0 || savedDays.size > 0) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                {savingDays.size > 0 ? (
                  t('gridSaving')
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{t('gridSaved')}</span>
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('availabilityHint')}</p>

          {gridError && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-600 dark:text-red-300">{gridError}</div>
          )}

          <div className="flex items-center gap-4 mb-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" /> {t('gridLegendAvailable')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-700 inline-block" /> {t('gridLegendBlocked')}
            </span>
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="border-collapse select-none" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th className="w-12" />
                  {GRID_DAY_ORDER.map((day) => (
                    <th key={day} className="text-[11px] font-black text-slate-500 dark:text-slate-400 pb-1.5 px-0.5">
                      {(lang === 'en' ? DAYS_SHORT_EN : DAYS_SHORT_KA)[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GRID_HOURS.map((hour, hourIndex) => (
                  <tr key={hour}>
                    <td className="text-[11px] font-bold text-slate-400 dark:text-slate-500 pr-2 text-right whitespace-nowrap">
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {GRID_DAY_ORDER.map((day) => {
                      const isOn = grid[day]?.[hourIndex] ?? false;
                      const isSaving = savingDays.has(day);
                      return (
                        <td key={day} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => toggleCell(day, hourIndex)}
                            disabled={isSaving}
                            aria-pressed={isOn}
                            aria-label={`${(lang === 'en' ? DAYS_EN : DAYS_KA)[day]} ${String(hour).padStart(2, '0')}:00`}
                            className={`w-9 h-8 sm:w-11 sm:h-9 rounded-md border transition-colors cursor-pointer disabled:cursor-wait ${
                              isOn
                                ? 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
                    {exception.startMinute != null && exception.endMinute != null && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        ({minutesToTime(exception.startMinute)}–{minutesToTime(exception.endMinute)})
                      </span>
                    )}
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

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-3 cursor-pointer">
            <input type="checkbox" checked={!blockWholeDay} onChange={(e) => setBlockWholeDay(!e.target.checked)} />
            {t('exceptionPartialDayToggle')}
          </label>
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
            {!blockWholeDay && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('from')}</label>
                  <input
                    type="time"
                    value={newExceptionFrom}
                    onChange={(e) => setNewExceptionFrom(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('to')}</label>
                  <input
                    type="time"
                    value={newExceptionTo}
                    onChange={(e) => setNewExceptionTo(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
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
              disabled={addingException || !newExceptionDate || (!blockWholeDay && newExceptionTo <= newExceptionFrom)}
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
  const { t } = useTranslation('mentorship');
  return (
    <ProtectedRoute>
      <RoleGate
        allowedRoles={['Mentor']}
        fallback={
          <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
            {t('mentorOnlyPage')}
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
