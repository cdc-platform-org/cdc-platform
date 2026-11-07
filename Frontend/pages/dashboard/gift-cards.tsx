import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Gift, Printer, Copy, Check, Send, Plus, Clock, CheckCircle2, Mail } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import GiftCardVisual from '../../src/components/giftCards/GiftCardVisual';
import { getMyGiftCards, resendGiftCard, formatGel, MyGiftCard } from '../../src/services/giftCardService';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'ჩემი სასაჩუქრე ბარათები',
    subtitle: 'ბარათები, რომლებიც სხვებს აჩუქე.',
    buy: 'ახალი ბარათის ყიდვა',
    loading: 'იტვირთება…',
    empty: 'ჯერ არცერთი ბარათი არ გიჩუქებია.',
    newCard: 'გადახდა წარმატებით დასრულდა! 🎉 საჩუქარი მზადაა.',
    pending: 'გადახდა მოწმდება…',
    scheduled: 'გაიგზავნება',
    delivered: 'გაიგზავნა',
    handOver: 'დასაბეჭდად მზადაა',
    used: 'გამოყენებული',
    balance: 'ნაშთი',
    unused: 'ჯერ არ გამოუყენებია',
    partly: 'ნაწილობრივ გამოყენებული',
    fully: 'სრულად გამოყენებული',
    inactive: 'გაუქმებული',
    to: 'მიმღები',
    print: 'დაბეჭდვა / PDF',
    copy: 'კოდის კოპირება',
    copied: 'დაკოპირდა',
    resend: 'ხელახლა გაგზავნა',
    resendTitle: 'ელფოსტა (შეგიძლია შეცვალო)',
    send: 'გაგზავნა',
    cancel: 'გაუქმება',
    sent: 'გაიგზავნა ✓',
    saved: 'შენახულია, გაიგზავნება დანიშნულ დღეს ✓',
    failed: 'ვერ გაიგზავნა. სცადე თავიდან.',
    validUntil: 'მოქმედებს',
  },
  en: {
    title: 'My gift cards',
    subtitle: 'Gift cards you bought for others.',
    buy: 'Buy a new gift card',
    loading: 'Loading…',
    empty: "You haven't gifted a card yet.",
    newCard: 'Payment complete! 🎉 Your gift is ready.',
    pending: 'Checking payment…',
    scheduled: 'Will be sent',
    delivered: 'Sent',
    handOver: 'Ready to print',
    used: 'Used',
    balance: 'Balance',
    unused: 'Not used yet',
    partly: 'Partly used',
    fully: 'Fully used',
    inactive: 'Deactivated',
    to: 'To',
    print: 'Print / PDF',
    copy: 'Copy code',
    copied: 'Copied',
    resend: 'Send again',
    resendTitle: 'Email (you can change it)',
    send: 'Send',
    cancel: 'Cancel',
    sent: 'Sent ✓',
    saved: 'Saved, it will be sent on the scheduled day ✓',
    failed: 'Could not send. Please try again.',
    validUntil: 'Valid until',
  },
};

function GiftCardRow({ card, lang, highlight, onUpdated }: { card: MyGiftCard; lang: 'ka' | 'en'; highlight: boolean; onUpdated: (c: MyGiftCard) => void }) {
  const t = dict[lang];
  const [copied, setCopied] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [email, setEmail] = useState(card.recipientEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dateLocale = lang === 'ka' ? 'ka-GE' : 'en-GB';

  const usage =
    card.isActive === false
      ? { label: t.inactive, cls: 'bg-red-100 text-red-700' }
      : card.balance == null
      ? null
      : card.balance >= card.amount
      ? { label: t.unused, cls: 'bg-slate-100 text-slate-700' }
      : card.balance > 0
      ? { label: t.partly, cls: 'bg-amber-100 text-amber-800' }
      : { label: t.fully, cls: 'bg-emerald-100 text-emerald-700' };

  const statusLine =
    card.status === 'PENDING_PAYMENT' ? (
      <span className="inline-flex items-center gap-1 text-amber-600"><Clock className="h-3.5 w-3.5" /> {t.pending}</span>
    ) : card.status === 'SCHEDULED' ? (
      <span className="inline-flex items-center gap-1 text-indigo-600">
        <Clock className="h-3.5 w-3.5" /> {t.scheduled}: {new Date(card.deliverAt).toLocaleDateString(dateLocale)}
      </span>
    ) : card.recipientEmail ? (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> {t.delivered}
        {card.deliveredAt && `: ${new Date(card.deliveredAt).toLocaleDateString(dateLocale)}`}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-emerald-600"><Printer className="h-3.5 w-3.5" /> {t.handOver}</span>
    );

  const copyCode = async () => {
    if (!card.code) return;
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const doResend = async () => {
    setBusy(true);
    setNote(null);
    try {
      const updated = await resendGiftCard(card.id, email.trim() || null);
      onUpdated(updated);
      setNote(updated.status === 'SCHEDULED' ? t.saved : t.sent);
      setResendOpen(false);
    } catch (err: any) {
      setNote(err?.response?.data?.message ?? t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grid gap-5 rounded-2xl border bg-white dark:bg-slate-900/60 p-4 sm:p-5 md:grid-cols-[300px_1fr] ${highlight ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-slate-200 dark:border-slate-800'}`}>
      <GiftCardVisual design={card.design} amountLabel={formatGel(card.amount)} recipientName={card.recipientName} senderName={card.senderName} code={card.code} lang={lang} />
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-slate-900 dark:text-white">{formatGel(card.amount)} ₾</p>
          {usage && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${usage.cls}`}>{usage.label}</span>}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p className="truncate">
            {t.to}: <strong className="text-slate-900 dark:text-white">{card.recipientName}</strong>
            {card.recipientEmail && <span className="text-slate-500"> · {card.recipientEmail}</span>}
          </p>
          <p className="text-xs">{statusLine}</p>
          {card.balance != null && (
            <p className="text-xs">
              {t.balance}: <strong>{formatGel(card.balance)} ₾</strong>
              {card.expiresAt && ` · ${t.validUntil}: ${new Date(card.expiresAt).toLocaleDateString(dateLocale)}`}
            </p>
          )}
        </div>
        {card.code && (
          <div className="mt-auto flex flex-wrap gap-2">
            <Link
              href={`/gift-cards/print/${card.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white no-underline hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" /> {t.print}
            </Link>
            <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-400">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t.copied : t.copy}
            </button>
            <button
              onClick={() => setResendOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-400"
            >
              <Mail className="h-3.5 w-3.5" /> {t.resend}
            </button>
          </div>
        )}
        {resendOpen && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              {t.resendTitle}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <button disabled={busy || !email.trim()} onClick={doResend} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                <Send className="h-3.5 w-3.5" /> {t.send}
              </button>
              <button onClick={() => setResendOpen(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600">
                {t.cancel}
              </button>
            </div>
          </div>
        )}
        {note && <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{note}</p>}
      </div>
    </div>
  );
}

function MyGiftCardsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const [cards, setCards] = useState<MyGiftCard[] | null>(null);
  const newId = typeof router.query.new === 'string' ? router.query.new : null;

  const load = useCallback(async () => {
    try {
      setCards(await getMyGiftCards());
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Right after payment the callback may land a moment later — re-check a
  // few times while the new card is still pending.
  useEffect(() => {
    if (!cards || !newId) return;
    const fresh = cards.find((c) => c.id === newId);
    if (fresh && fresh.status === 'PENDING_PAYMENT') {
      const timer = setTimeout(load, 3000);
      return () => clearTimeout(timer);
    }
  }, [cards, newId, load]);

  return (
    <>
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <SiteHeader />
      <main className="min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <BackButton fallbackHref="/dashboard" />
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
                <Gift className="h-6 w-6 text-indigo-600" /> {t.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>
            </div>
            <Link href="/gift-cards" className="inline-flex items-center gap-1.5 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white no-underline hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> {t.buy}
            </Link>
          </div>

          {newId && cards?.some((c) => c.id === newId && c.status !== 'PENDING_PAYMENT') && (
            <p className="mt-5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t.newCard}</p>
          )}

          <div className="mt-6 space-y-4">
            {!cards ? (
              <p className="text-sm text-slate-500">{t.loading}</p>
            ) : cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
                <p className="text-4xl">🎁</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.empty}</p>
                <Link href="/gift-cards" className="mt-4 inline-block font-bold text-indigo-600">
                  {t.buy}
                </Link>
              </div>
            ) : (
              cards.map((c) => (
                <GiftCardRow key={c.id} card={c} lang={lang} highlight={c.id === newId} onUpdated={(u) => setCards((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? null)} />
              ))
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default function MyGiftCardsPage() {
  return (
    <ProtectedRoute>
      <MyGiftCardsContent />
    </ProtectedRoute>
  );
}
