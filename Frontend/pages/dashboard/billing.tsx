import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { CreditCard, Download, Clock, Zap, FileText, XCircle, AlertTriangle } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { formatPrice } from '../../src/utils/coursePricing';
import {
  getMySubscriptions,
  setSubscriptionAutoRenew,
  cancelMySubscription,
  downloadSubscriptionInvoice,
} from '../../src/services/billingService';
import { BillingSubscription, BillingSubscriptionStatus } from '../../src/types/billing';
import { resolveLocale, SupportedLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'ბილინგი',
    subtitle: 'თქვენი აქტიური ბიზნეს ხელსაწყოების გამოწერები, მიმდინარე ციკლის ხარჯი და ინვოისები.',
    fallback: 'ბილინგის გვერდი ხელმისაწვდომია მხოლოდ ბიზნეს ანგარიშებისა და ადმინისტრატორებისთვის.',
    loading: 'იტვირთება…',
    loadFailed: 'ბილინგის მონაცემების ჩატვირთვა ვერ მოხერხდა.',
    empty: 'ჯერ არცერთი აქტიური გამოწერა არ გაქვთ.',
    emptyCta: 'დაიწყეთ AI ინსტრუმენტების უფასო საცდელი →',
    productLabel: { AI_AGENT_SUITE: 'AI აგენტების პაკეტი' },
    status: {
      TRIALING: 'საცდელი პერიოდი',
      ACTIVE: 'აქტიური',
      PAST_DUE: 'გადახდა ვადაგადაცილებულია',
      CANCELED: 'გაუქმებული',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `საცდელი მთავრდება: ${new Date(date).toLocaleDateString('ka-GE')}`,
    baseFee: 'პლატფორმის საბაზისო საფასური',
    usage: 'რეალურ დროში მოხმარების მრიცხველი',
    total: 'სავარაუდო ყოველთვიური ჯამი',
    perMonth: '/თვე',
    autoRenew: 'ავტომატური გადახდა',
    on: 'ჩართული',
    off: 'გამორთული',
    card: 'ბარათი',
    noCard: 'ბარათი მიბმული არ არის',
    invoicesTitle: 'ინვოისები და გადახდების ისტორია',
    downloadInvoice: 'PDF ინვოისის ჩამოტვირთვა',
    downloading: 'იტვირთება…',
    invoiceEstimateNote: 'ეს არის მიმდინარე ციკლის შეფასება — რეალური გადახდის სისტემა ჯერ არ არის გააქტიურებული.',
    downloadFailed: 'ინვოისის ჩამოტვირთვა ვერ მოხერხდა.',
    cancelSubscription: 'გამოწერის გაუქმება',
    canceling: 'უქმდება…',
    cancelModalTitle: 'გამოწერის გაუქმება',
    cancelModalWarning: 'დარწმუნებული ხართ? გამოწერის გაუქმებით თქვენ მყისიერად დაჰკარგავთ ულიმიტო წვდომას აღნიშნულ სერვისზე.',
    cancelModalConfirm: 'დიახ, გავაუქმო',
    cancelModalBack: 'უკან დაბრუნება',
    cancelFailed: 'გამოწერის გაუქმება ვერ მოხერხდა.',
    canceledNote: 'გამოწერა გაუქმებულია — ულიმიტო წვდომა შეწყვეტილია.',
  },
  en: {
    title: 'Billing',
    subtitle: 'Your active business tool subscriptions, current-cycle cost, and invoices.',
    fallback: 'The Billing page is available only to Business accounts and administrators.',
    loading: 'Loading…',
    loadFailed: 'Could not load billing data.',
    empty: "You don't have any active subscriptions yet.",
    emptyCta: 'Start a free AI Tools trial →',
    productLabel: { AI_AGENT_SUITE: 'AI Agent Suite' },
    status: {
      TRIALING: 'Trial',
      ACTIVE: 'Active',
      PAST_DUE: 'Past Due',
      CANCELED: 'Canceled',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `Trial ends: ${new Date(date).toLocaleDateString('en-US')}`,
    baseFee: 'Platform Maintenance Base Fee',
    usage: 'Real-Time Usage Counter',
    total: 'Estimated Monthly Total',
    perMonth: '/mo',
    autoRenew: 'Auto-Payment',
    on: 'On',
    off: 'Off',
    card: 'Card',
    noCard: 'No card bound',
    invoicesTitle: 'Invoices & Payment History',
    downloadInvoice: 'Download PDF Invoice',
    downloading: 'Downloading…',
    invoiceEstimateNote: "This is an estimate for the current cycle — real charging isn't switched on yet.",
    downloadFailed: 'Could not download the invoice.',
    cancelSubscription: 'Cancel Subscription',
    canceling: 'Canceling…',
    cancelModalTitle: 'Cancel Subscription',
    cancelModalWarning: 'Are you sure? Canceling this subscription will immediately revoke your unlimited access to this service.',
    cancelModalConfirm: 'Yes, cancel it',
    cancelModalBack: 'Go back',
    cancelFailed: 'Unable to cancel the subscription.',
    canceledNote: 'Subscription canceled — unlimited access has been revoked.',
  },
  de: {
    title: 'Billing',
    subtitle: 'Your active business tool subscriptions, current-cycle cost, and invoices.',
    fallback: 'The Billing page is available only to Business accounts and administrators.',
    loading: 'Loading…',
    loadFailed: 'Could not load billing data.',
    empty: "You don't have any active subscriptions yet.",
    emptyCta: 'Start a free AI Tools trial →',
    productLabel: { AI_AGENT_SUITE: 'AI Agent Suite' },
    status: {
      TRIALING: 'Trial',
      ACTIVE: 'Active',
      PAST_DUE: 'Past Due',
      CANCELED: 'Canceled',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `Trial ends: ${new Date(date).toLocaleDateString('en-US')}`,
    baseFee: 'Platform Maintenance Base Fee',
    usage: 'Real-Time Usage Counter',
    total: 'Estimated Monthly Total',
    perMonth: '/mo',
    autoRenew: 'Auto-Payment',
    on: 'On',
    off: 'Off',
    card: 'Card',
    noCard: 'No card bound',
    invoicesTitle: 'Invoices & Payment History',
    downloadInvoice: 'Download PDF Invoice',
    downloading: 'Downloading…',
    invoiceEstimateNote: "This is an estimate for the current cycle — real charging isn't switched on yet.",
    downloadFailed: 'Could not download the invoice.',
    cancelSubscription: 'Cancel Subscription',
    canceling: 'Canceling…',
    cancelModalTitle: 'Cancel Subscription',
    cancelModalWarning: 'Are you sure? Canceling this subscription will immediately revoke your unlimited access to this service.',
    cancelModalConfirm: 'Yes, cancel it',
    cancelModalBack: 'Go back',
    cancelFailed: 'Unable to cancel the subscription.',
    canceledNote: 'Subscription canceled — unlimited access has been revoked.',
  },
  es: {
    title: 'Billing',
    subtitle: 'Your active business tool subscriptions, current-cycle cost, and invoices.',
    fallback: 'The Billing page is available only to Business accounts and administrators.',
    loading: 'Loading…',
    loadFailed: 'Could not load billing data.',
    empty: "You don't have any active subscriptions yet.",
    emptyCta: 'Start a free AI Tools trial →',
    productLabel: { AI_AGENT_SUITE: 'AI Agent Suite' },
    status: {
      TRIALING: 'Trial',
      ACTIVE: 'Active',
      PAST_DUE: 'Past Due',
      CANCELED: 'Canceled',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `Trial ends: ${new Date(date).toLocaleDateString('en-US')}`,
    baseFee: 'Platform Maintenance Base Fee',
    usage: 'Real-Time Usage Counter',
    total: 'Estimated Monthly Total',
    perMonth: '/mo',
    autoRenew: 'Auto-Payment',
    on: 'On',
    off: 'Off',
    card: 'Card',
    noCard: 'No card bound',
    invoicesTitle: 'Invoices & Payment History',
    downloadInvoice: 'Download PDF Invoice',
    downloading: 'Downloading…',
    invoiceEstimateNote: "This is an estimate for the current cycle — real charging isn't switched on yet.",
    downloadFailed: 'Could not download the invoice.',
    cancelSubscription: 'Cancel Subscription',
    canceling: 'Canceling…',
    cancelModalTitle: 'Cancel Subscription',
    cancelModalWarning: 'Are you sure? Canceling this subscription will immediately revoke your unlimited access to this service.',
    cancelModalConfirm: 'Yes, cancel it',
    cancelModalBack: 'Go back',
    cancelFailed: 'Unable to cancel the subscription.',
    canceledNote: 'Subscription canceled — unlimited access has been revoked.',
  },
  fr: {
    title: 'Billing',
    subtitle: 'Your active business tool subscriptions, current-cycle cost, and invoices.',
    fallback: 'The Billing page is available only to Business accounts and administrators.',
    loading: 'Loading…',
    loadFailed: 'Could not load billing data.',
    empty: "You don't have any active subscriptions yet.",
    emptyCta: 'Start a free AI Tools trial →',
    productLabel: { AI_AGENT_SUITE: 'AI Agent Suite' },
    status: {
      TRIALING: 'Trial',
      ACTIVE: 'Active',
      PAST_DUE: 'Past Due',
      CANCELED: 'Canceled',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `Trial ends: ${new Date(date).toLocaleDateString('en-US')}`,
    baseFee: 'Platform Maintenance Base Fee',
    usage: 'Real-Time Usage Counter',
    total: 'Estimated Monthly Total',
    perMonth: '/mo',
    autoRenew: 'Auto-Payment',
    on: 'On',
    off: 'Off',
    card: 'Card',
    noCard: 'No card bound',
    invoicesTitle: 'Invoices & Payment History',
    downloadInvoice: 'Download PDF Invoice',
    downloading: 'Downloading…',
    invoiceEstimateNote: "This is an estimate for the current cycle — real charging isn't switched on yet.",
    downloadFailed: 'Could not download the invoice.',
    cancelSubscription: 'Cancel Subscription',
    canceling: 'Canceling…',
    cancelModalTitle: 'Cancel Subscription',
    cancelModalWarning: 'Are you sure? Canceling this subscription will immediately revoke your unlimited access to this service.',
    cancelModalConfirm: 'Yes, cancel it',
    cancelModalBack: 'Go back',
    cancelFailed: 'Unable to cancel the subscription.',
    canceledNote: 'Subscription canceled — unlimited access has been revoked.',
  },
  uk: {
    title: 'Billing',
    subtitle: 'Your active business tool subscriptions, current-cycle cost, and invoices.',
    fallback: 'The Billing page is available only to Business accounts and administrators.',
    loading: 'Loading…',
    loadFailed: 'Could not load billing data.',
    empty: "You don't have any active subscriptions yet.",
    emptyCta: 'Start a free AI Tools trial →',
    productLabel: { AI_AGENT_SUITE: 'AI Agent Suite' },
    status: {
      TRIALING: 'Trial',
      ACTIVE: 'Active',
      PAST_DUE: 'Past Due',
      CANCELED: 'Canceled',
    } as Record<BillingSubscriptionStatus, string>,
    trialEndsAt: (date: string) => `Trial ends: ${new Date(date).toLocaleDateString('en-US')}`,
    baseFee: 'Platform Maintenance Base Fee',
    usage: 'Real-Time Usage Counter',
    total: 'Estimated Monthly Total',
    perMonth: '/mo',
    autoRenew: 'Auto-Payment',
    on: 'On',
    off: 'Off',
    card: 'Card',
    noCard: 'No card bound',
    invoicesTitle: 'Invoices & Payment History',
    downloadInvoice: 'Download PDF Invoice',
    downloading: 'Downloading…',
    invoiceEstimateNote: "This is an estimate for the current cycle — real charging isn't switched on yet.",
    downloadFailed: 'Could not download the invoice.',
    cancelSubscription: 'Cancel Subscription',
    canceling: 'Canceling…',
    cancelModalTitle: 'Cancel Subscription',
    cancelModalWarning: 'Are you sure? Canceling this subscription will immediately revoke your unlimited access to this service.',
    cancelModalConfirm: 'Yes, cancel it',
    cancelModalBack: 'Go back',
    cancelFailed: 'Unable to cancel the subscription.',
    canceledNote: 'Subscription canceled — unlimited access has been revoked.',
  },
};

const STATUS_BADGE: Record<BillingSubscriptionStatus, string> = {
  TRIALING: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  PAST_DUE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  CANCELED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
};

function SubscriptionCard({ sub, lang, t }: { sub: BillingSubscription; lang: SupportedLocale; t: typeof dict['ka'] }) {
  const [autoRenew, setAutoRenew] = useState(sub.autoRenew);
  const [status, setStatus] = useState(sub.status);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usageTetri = sub.currentCycleUsageTetri;
  const totalTetri = sub.baseFeeTetri + usageTetri;

  const handleToggleAutoRenew = async () => {
    setTogglingAutoRenew(true);
    setError(null);
    const next = !autoRenew;
    try {
      const updated = await setSubscriptionAutoRenew(sub.id, next);
      setAutoRenew(updated.autoRenew);
    } catch {
      setError(t.downloadFailed);
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  // Instant revocation: the backend flips status to CANCELED and revokes
  // access (aiSubscriptionActive off for AI_AGENT_SUITE) synchronously
  // before this resolves — see billingService.cancelSubscription's own
  // comment on revokeAccessAndNotify.
  const handleCancel = async () => {
    setCanceling(true);
    setError(null);
    try {
      const updated = await cancelMySubscription(sub.id);
      setStatus(updated.status);
      setAutoRenew(updated.autoRenew);
      setShowCancelModal(false);
    } catch {
      setError(t.cancelFailed);
      setShowCancelModal(false);
    } finally {
      setCanceling(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadSubscriptionInvoice(sub.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdc-billing-statement-${sub.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.downloadFailed);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-black tracking-wide">{t.productLabel[sub.productType]}</h3>
          {status === 'TRIALING' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t.trialEndsAt(sub.trialEndsAt)}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${STATUS_BADGE[status]}`}>
          {t.status[status]}
        </span>
      </div>

      {/* LIVE ESTIMATED BILL */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-5 mb-5">
        <div className="flex items-center justify-between text-sm mb-2.5">
          <span className="text-slate-600 dark:text-slate-300">{t.baseFee}</span>
          <span className="font-bold">{formatPrice(sub.baseFeeTetri)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-3.5">
          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-500" />
            {t.usage}
          </span>
          <span className="font-bold">{formatPrice(usageTetri)}</span>
        </div>
        <div className="h-px bg-slate-200 dark:bg-slate-800 mb-3.5" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-black">{t.total}</span>
          <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
            {formatPrice(totalTetri)}
            <span className="text-xs font-bold text-slate-400 ml-1">{t.perMonth}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            {sub.paymentMethod ? `${sub.paymentMethod.brand} •••• ${sub.paymentMethod.last4}` : t.noCard}
          </span>
        </div>
        {status !== 'CANCELED' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAutoRenew}
              disabled={togglingAutoRenew}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer disabled:opacity-50 ${
                autoRenew
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.autoRenew}: {autoRenew ? t.on : t.off}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t.cancelSubscription}
            </button>
          </div>
        )}
      </div>

      {status === 'CANCELED' && <p className="text-[11px] text-slate-400 mb-4">{t.canceledNote}</p>}

      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 rounded-xl border-none cursor-pointer hover:opacity-90 disabled:opacity-60"
      >
        <Download className="w-3.5 h-3.5" />
        {downloading ? t.downloading : t.downloadInvoice}
      </button>
      <p className="text-[11px] text-slate-400 mt-2">{t.invoiceEstimateNote}</p>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !canceling && setShowCancelModal(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">{t.cancelModalTitle}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">{t.cancelModalWarning}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={canceling}
                className="flex-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2.5 rounded-xl border-none cursor-pointer disabled:opacity-60"
              >
                {canceling ? t.canceling : t.cancelModalConfirm}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="flex-1 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-60"
              >
                {t.cancelModalBack}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillingContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSubscriptions(await getMySubscriptions());
    } catch {
      setLoadError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard/client" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <RoleGate
          allowedRoles={['Client', 'SuperAdmin']}
          fallback={<p className="text-sm text-slate-500 dark:text-slate-400">{t.fallback}</p>}
        >
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
          ) : loadError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
          ) : subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
              <a
                href="/dashboard/ai-tools"
                className="inline-flex text-sm font-bold text-cyan-600 dark:text-cyan-400 no-underline hover:underline"
              >
                {t.emptyCta}
              </a>
            </div>
          ) : (
            <>
              {subscriptions.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} lang={lang} t={t} />
              ))}

              <div className="mt-2">
                <h2 className="text-sm font-black tracking-wide flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {t.invoicesTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ka'
                    ? 'თითოეული გამოწერის ბარათზე ზემოთ შეგიძლიათ ჩამოტვირთოთ მიმდინარე ციკლის PDF ინვოისი.'
                    : 'Use the "Download PDF Invoice" button on each subscription card above to get the current cycle statement.'}
                </p>
              </div>
            </>
          )}
        </RoleGate>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute>
      <BillingContent />
    </ProtectedRoute>
  );
}
