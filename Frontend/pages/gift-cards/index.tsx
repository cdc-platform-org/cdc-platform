import { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Gift, Mail, Printer, CalendarHeart, Send, ShieldCheck, Sparkles, Wallet, Search } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import SEOHead from '../../src/components/seo/SEOHead';
import GiftCardVisual, { GIFT_THEMES } from '../../src/components/giftCards/GiftCardVisual';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { checkoutGiftCard, GiftCardDesign } from '../../src/services/giftCardService';
import { resolveLocale } from '@/src/utils/locale';

const PRESETS = [10, 20, 50, 100];
const MIN_GEL = 5;
const MAX_GEL = 1000;
const DESIGNS: GiftCardDesign[] = ['classic', 'birthday', 'celebration', 'kids'];

const dict = {
  ka: {
    seoTitle: 'სასაჩუქრე ბარათი',
    seoDesc: 'აჩუქე ცოდნა: CDC-ის სასაჩუქრე ბარათი მოქმედებს ყველა კურსზე, ტრენინგზე, ციფრულ პროდუქტსა და AI საბავშვო წიგნზე.',
    badge: 'სასაჩუქრე ბარათი',
    title: 'აჩუქე ცოდნა, რომელიც რჩება',
    subtitle: 'ერთი ბარათი ყველაფერზე: კურსები, ლაივ ტრენინგები, ციფრული პროდუქტები და AI საბავშვო წიგნი. მიმღები თვითონ აირჩევს.',
    amount: 'თანხა',
    custom: 'სხვა თანხა',
    customHint: `${MIN_GEL}–${MAX_GEL} ₾`,
    design: 'დიზაინი',
    designs: { classic: 'კლასიკური', birthday: 'დაბადების დღე', celebration: 'ზეიმი', kids: 'ბავშვებისთვის' } as Record<GiftCardDesign, string>,
    recipient: 'ვის უგზავნი?',
    recipientName: 'მიმღების სახელი',
    senderName: 'შენი სახელი (ბარათზე ასე დაიწერება)',
    delivery: 'როგორ მივიდეს?',
    byEmail: 'ელფოსტით გავუგზავნოთ',
    byPrint: 'თვითონ დავბეჭდავ და გადავცემ',
    recipientEmail: 'მიმღების ელფოსტა',
    when: 'როდის გაიგზავნოს?',
    now: 'გადახდისთანავე',
    later: 'კონკრეტულ დღეს',
    laterHint: 'დილის 9 საათზე (თბილისის დროით), მაგ. დაბადების დღეს.',
    message: 'პირადი მილოცვა (არასავალდებულო)',
    messagePh: 'მაგ.: გილოცავ დაბადების დღეს! ვიცი, რომ ეს კურსი ძალიან მოგეწონება 💜',
    suggestion: 'შენ მას ურჩევ',
    suggestionNote: 'ბარათი მაინც ყველა პროდუქტზე იმუშავებს.',
    removeSuggestion: 'მოხსნა',
    total: 'გადასახდელი',
    pay: 'გადახდა და გაგზავნა',
    paying: 'გადამისამართება ბანკზე…',
    secure: 'უსაფრთხო გადახდა საქართველოს ბანკით',
    errAmount: `თანხა უნდა იყოს ${MIN_GEL}-დან ${MAX_GEL} ₾-მდე.`,
    errNames: 'შეავსე მიმღების და შენი სახელი.',
    errEmail: 'ჩაწერე მიმღების ელფოსტა.',
    errDate: 'აირჩიე გაგზავნის დღე (დღეს ან მომავალში, მაქსიმუმ 1 წელი).',
    errGeneric: 'გადახდის დაწყება ვერ მოხერხდა. სცადე თავიდან.',
    howTitle: 'როგორ მუშაობს',
    how: [
      { t: 'აირჩიე თანხა და დიზაინი', d: 'დაწერე მილოცვა და აირჩიე, როდის მივიდეს.' },
      { t: 'მიმღებს მიუვა ლამაზი ბარათი', d: 'უნიკალური კოდით ელფოსტაზე, ან დაბეჭდე და ხელით გადაეცი.' },
      { t: 'იყენებს ნებისმიერ პროდუქტზე', d: 'კოდს წერს პრომო ველში. ნაშთი შემდეგი ყიდვისთვის რჩება.' },
    ],
    perks: ['მოქმედებს 1 წელი', 'ნაშთი არ იკარგება', 'ყველა პროდუქტზე', 'დაბეჭდვადი PDF ბარათი'],
    haveCard: 'გაქვს სასაჩუქრე ბარათი?',
    checkBalance: 'შეამოწმე ნაშთი',
    myCards: 'ჩემი ნაყიდი ბარათები',
    previewRecipient: 'მიმღები',
    previewSender: 'შენ',
  },
  en: {
    seoTitle: 'Gift Card',
    seoDesc: 'Give the gift of learning: a CDC gift card works on every course, live training, digital product and AI children\'s book.',
    badge: 'Gift card',
    title: 'Give a gift that keeps teaching',
    subtitle: 'One card for everything: courses, live trainings, digital products and the AI children\'s book. They choose.',
    amount: 'Amount',
    custom: 'Other amount',
    customHint: `${MIN_GEL}–${MAX_GEL} GEL`,
    design: 'Design',
    designs: { classic: 'Classic', birthday: 'Birthday', celebration: 'Celebration', kids: 'For kids' } as Record<GiftCardDesign, string>,
    recipient: 'Who is it for?',
    recipientName: "Recipient's name",
    senderName: 'Your name (as shown on the card)',
    delivery: 'How should it arrive?',
    byEmail: 'Email it to them',
    byPrint: "I'll print it and hand it over",
    recipientEmail: "Recipient's email",
    when: 'When should we send it?',
    now: 'Right after payment',
    later: 'On a specific day',
    laterHint: 'At 9:00 am Tbilisi time, e.g. on their birthday.',
    message: 'Personal message (optional)',
    messagePh: "e.g. Happy birthday! I know you'll love this course 💜",
    suggestion: 'You suggest',
    suggestionNote: 'The card still works on every product.',
    removeSuggestion: 'Remove',
    total: 'Total',
    pay: 'Pay and send',
    paying: 'Redirecting to the bank…',
    secure: 'Secure payment by Bank of Georgia',
    errAmount: `Amount must be between ${MIN_GEL} and ${MAX_GEL} GEL.`,
    errNames: "Enter the recipient's name and yours.",
    errEmail: "Enter the recipient's email.",
    errDate: 'Pick a delivery day (today or later, at most 1 year ahead).',
    errGeneric: 'Could not start the payment. Please try again.',
    howTitle: 'How it works',
    how: [
      { t: 'Pick an amount and design', d: 'Write a message and choose when it arrives.' },
      { t: 'They get a beautiful card', d: 'With a unique code by email, or print it and hand it over.' },
      { t: 'They use it on anything', d: 'Enter the code in the promo field. Any balance is kept for next time.' },
    ],
    perks: ['Valid for 1 year', 'Balance never lost', 'Works on every product', 'Printable PDF card'],
    haveCard: 'Got a gift card?',
    checkBalance: 'Check balance',
    myCards: 'Gift cards I bought',
    previewRecipient: 'Recipient',
    previewSender: 'You',
  },
};

const inputClass =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

function todayInTbilisi(): string {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

// A same-site path only (it becomes a button in the gift email).
function safePath(v: unknown): string | null {
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && v.length <= 300 ? v : null;
}

export default function GiftCardsPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState('');
  const [design, setDesign] = useState<GiftCardDesign>('classic');
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [byEmail, setByEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendLater, setSendLater] = useState(false);
  const [deliverDate, setDeliverDate] = useState('');
  const [message, setMessage] = useState('');
  const [suggestedItem, setSuggestedItem] = useState<string | null>(null);
  const [suggestedUrl, setSuggestedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Prefill from a product's "Gift this" button: ?amount=35&item=…&url=/courses/…
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    const a = Number(q.amount);
    if (Number.isFinite(a) && a >= MIN_GEL && a <= MAX_GEL) {
      const rounded = Math.round(a * 100) / 100;
      if (PRESETS.includes(rounded)) setAmount(rounded);
      else {
        setAmount(0);
        setCustomAmount(String(rounded));
      }
    }
    if (typeof q.item === 'string' && q.item.trim()) setSuggestedItem(q.item.trim().slice(0, 150));
    setSuggestedUrl(safePath(q.url));
    if (typeof q.design === 'string' && (DESIGNS as string[]).includes(q.design)) setDesign(q.design as GiftCardDesign);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (user?.name && !senderName) setSenderName(user.name.split(' ')[0] ?? user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const amountGel = amount > 0 ? amount : Number(customAmount.replace(',', '.'));
  const amountValid = Number.isFinite(amountGel) && amountGel >= MIN_GEL && amountGel <= MAX_GEL && Math.round(amountGel * 100) === amountGel * 100;
  const amountLabel = amountValid ? (Number.isInteger(amountGel) ? String(amountGel) : amountGel.toFixed(2)) : '0';
  const minDate = todayInTbilisi();
  const maxDate = useMemo(() => new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), []);

  const startCheckout = async () => {
    setError(null);
    let deliverAt: string | null = null;
    if (byEmail && sendLater) {
      // 09:00 in Tbilisi (UTC+4, no DST) on the chosen day.
      deliverAt = new Date(`${deliverDate}T05:00:00.000Z`).toISOString();
    }
    setSubmitting(true);
    try {
      const res = await checkoutGiftCard({
        amountGel,
        senderName: senderName.trim(),
        recipientName: recipientName.trim(),
        recipientEmail: byEmail ? recipientEmail.trim() : null,
        message: message.trim() || null,
        design,
        deliverAt,
        suggestedItem,
        suggestedUrl,
        lang,
      });
      window.location.href = res.redirectUrl;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.errGeneric);
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amountValid) return setError(t.errAmount);
    if (!recipientName.trim() || !senderName.trim()) return setError(t.errNames);
    if (byEmail && !/^\S+@\S+\.\S+$/.test(recipientEmail.trim())) return setError(t.errEmail);
    if (byEmail && sendLater && (!deliverDate || deliverDate < minDate || deliverDate > maxDate)) return setError(t.errDate);
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: startCheckout });
      return;
    }
    startCheckout();
  };

  return (
    <>
      <SEOHead title={t.seoTitle} description={t.seoDesc} canonicalPath="/gift-cards" />
      <SiteHeader />
      <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-[#0b0f19] dark:via-[#0b0f19] dark:to-[#0b0f19]">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:pt-14 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
            <Gift className="h-3.5 w-3.5" /> {t.badge}
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">{t.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-400">{t.subtitle}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {t.perks.map((p) => (
              <span key={p} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                ✓ {p}
              </span>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 lg:grid-cols-[1fr_440px]">
          {/* Form */}
          <div className="space-y-6 order-2 lg:order-1">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{t.amount}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => {
                      setAmount(p);
                      setCustomAmount('');
                    }}
                    className={`rounded-xl border px-3 py-3 text-lg font-black transition ${
                      amount === p
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    {p} ₾
                  </button>
                ))}
                <div className={`col-span-2 sm:col-span-1 rounded-xl border ${amount === 0 ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input
                    inputMode="decimal"
                    aria-label={t.custom}
                    placeholder={t.custom}
                    value={customAmount}
                    onFocus={() => setAmount(0)}
                    onChange={(e) => {
                      setAmount(0);
                      setCustomAmount(e.target.value.replace(/[^0-9.,]/g, ''));
                    }}
                    className="h-full w-full rounded-xl bg-transparent px-3 py-3 text-center text-lg font-black text-slate-900 dark:text-white placeholder:text-sm placeholder:font-semibold focus:outline-none"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t.customHint}</p>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{t.design}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DESIGNS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDesign(d)}
                    className={`group rounded-xl border p-2 text-left transition ${
                      design === d ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    <div className="flex aspect-[1.586/1] items-center justify-center rounded-lg text-2xl" style={{ background: GIFT_THEMES[d].swatch }}>
                      {GIFT_THEMES[d].emoji}
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{t.designs[d]}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.recipient}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {t.recipientName}
                  <input className={`${inputClass} mt-1`} maxLength={60} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {t.senderName}
                  <input className={`${inputClass} mt-1`} maxLength={60} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {t.message}
                <textarea
                  className={`${inputClass} mt-1 min-h-[96px]`}
                  maxLength={500}
                  placeholder={t.messagePh}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400">{message.length}/500</span>
              </label>
              {suggestedItem && (
                <div className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3.5 py-2.5">
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <p>
                      🎯 {t.suggestion}: <strong>{suggestedItem}</strong>
                    </p>
                    <p className="text-amber-700 dark:text-amber-300/80">{t.suggestionNote}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestedItem(null);
                      setSuggestedUrl(null);
                    }}
                    className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline"
                  >
                    {t.removeSuggestion}
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.delivery}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { v: true, icon: Mail, label: t.byEmail },
                  { v: false, icon: Printer, label: t.byPrint },
                ].map(({ v, icon: Icon, label }) => (
                  <button
                    type="button"
                    key={String(v)}
                    onClick={() => setByEmail(v)}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-sm font-semibold transition ${
                      byEmail === v
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> {label}
                  </button>
                ))}
              </div>
              {byEmail && (
                <>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {t.recipientEmail}
                    <input type="email" className={`${inputClass} mt-1`} maxLength={200} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                  </label>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.when}</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      {[
                        { v: false, icon: Send, label: t.now },
                        { v: true, icon: CalendarHeart, label: t.later },
                      ].map(({ v, icon: Icon, label }) => (
                        <button
                          type="button"
                          key={String(v)}
                          onClick={() => setSendLater(v)}
                          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                            sendLater === v
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-200'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" /> {label}
                        </button>
                      ))}
                    </div>
                    {sendLater && (
                      <div className="mt-2">
                        <input type="date" className={inputClass} min={minDate} max={maxDate} value={deliverDate} onChange={(e) => setDeliverDate(e.target.value)} />
                        <p className="mt-1 text-[11px] text-slate-500">{t.laterHint}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Live preview + pay */}
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-24 space-y-4">
              <GiftCardVisual
                design={design}
                amountLabel={amountLabel}
                recipientName={recipientName.trim() || t.previewRecipient}
                senderName={senderName.trim() || t.previewSender}
                message={message.trim() || null}
                lang={lang}
              />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{t.total}</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{amountLabel} ₾</span>
                </div>
                {error && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:opacity-60"
                >
                  <Gift className="h-4 w-4" /> {submitting ? t.paying : t.pay}
                </button>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t.secure}
                </p>
              </div>
            </div>
          </aside>
        </form>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <h2 className="text-center text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{t.howTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {t.how.map((step, i) => {
              const Icon = [Sparkles, Mail, Wallet][i];
              return (
                <div key={step.t} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                    {i + 1}. {step.t}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{step.d}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{t.haveCard}</span>
            <Link href="/gift-cards/redeem" className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:underline">
              <Search className="h-4 w-4" /> {t.checkBalance}
            </Link>
            {isAuthenticated && (
              <>
                <span className="hidden sm:inline text-slate-300">|</span>
                <Link href="/dashboard/gift-cards" className="font-bold text-indigo-600 hover:underline">
                  {t.myCards}
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
