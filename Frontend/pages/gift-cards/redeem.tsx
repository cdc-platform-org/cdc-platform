import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search, Copy, Check, GraduationCap, Radio, ShoppingBag, BookOpen } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import SEOHead from '../../src/components/seo/SEOHead';
import GiftCardVisual from '../../src/components/giftCards/GiftCardVisual';
import { checkGiftCardBalance, formatGel, GiftCardBalance } from '../../src/services/giftCardService';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'სასაჩუქრე ბარათი',
    subtitle: 'ჩაწერე კოდი და ნახე, რამდენი დაგრჩა.',
    placeholder: 'GIFT-XXXX-XXXX',
    check: 'შემოწმება',
    checking: 'მოწმდება…',
    balance: 'ნაშთი',
    of: 'საწყისი',
    validUntil: 'მოქმედებს',
    inactive: 'ეს ბარათი აღარ მოქმედებს.',
    empty: 'ბარათის თანხა სრულად გამოყენებულია.',
    howTitle: 'როგორ გამოვიყენო?',
    how: 'აირჩიე პროდუქტი, გადახდისას ჩაწერე კოდი „პრომო კოდის“ ველში. ნაშთი შემდეგი ყიდვისთვის შეგრჩება.',
    copy: 'კოდის კოპირება',
    copied: 'დაკოპირდა',
    suggested: 'გირჩევენ',
    open: 'ნახვა',
    shop: 'აირჩიე საჩუქარი',
    courses: 'კურსები',
    trainings: 'ლაივ ტრენინგები',
    store: 'ციფრული პროდუქტები',
    book: 'AI საბავშვო წიგნი',
    notFound: 'სასაჩუქრე ბარათი ვერ მოიძებნა.',
    buyOne: 'გინდა შენც აჩუქო ვინმეს?',
    buyLink: 'სასაჩუქრე ბარათის ყიდვა',
  },
  en: {
    title: 'Gift card',
    subtitle: 'Enter your code to see your balance.',
    placeholder: 'GIFT-XXXX-XXXX',
    check: 'Check',
    checking: 'Checking…',
    balance: 'Balance',
    of: 'Original',
    validUntil: 'Valid until',
    inactive: 'This card is no longer active.',
    empty: 'This card has been fully used.',
    howTitle: 'How do I use it?',
    how: 'Pick a product and enter the code in the promo code field at checkout. Any balance is kept for next time.',
    copy: 'Copy code',
    copied: 'Copied',
    suggested: 'Suggested for you',
    open: 'Open',
    shop: 'Choose your gift',
    courses: 'Courses',
    trainings: 'Live trainings',
    store: 'Digital products',
    book: "AI children's book",
    notFound: 'Gift card not found.',
    buyOne: 'Want to gift someone too?',
    buyLink: 'Buy a gift card',
  },
};

export default function RedeemGiftCardPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const [code, setCode] = useState('');
  const [card, setCard] = useState<GiftCardBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const lookup = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError(null);
    try {
      setCard(await checkGiftCardBalance(c));
    } catch (err: any) {
      setCard(null);
      setError(err?.response?.data?.message ?? t.notFound);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof router.query.code === 'string') {
      setCode(router.query.code.toUpperCase());
      lookup(router.query.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookup(code);
  };

  const copyCode = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — code is visible anyway */
    }
  };

  const dateLocale = lang === 'ka' ? 'ka-GE' : 'en-GB';
  const shopLinks = [
    { href: '/courses', label: t.courses, icon: GraduationCap },
    { href: '/live-trainings', label: t.trainings, icon: Radio },
    { href: '/store', label: t.store, icon: ShoppingBag },
    { href: '/dashboard/tools/childrens-book', label: t.book, icon: BookOpen },
  ];

  return (
    <>
      <SEOHead title={t.title} description={t.subtitle} canonicalPath="/gift-cards/redeem" noIndex />
      <SiteHeader />
      <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-[#0b0f19] dark:via-[#0b0f19] dark:to-[#0b0f19]">
        <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
          <h1 className="text-center text-3xl font-black text-slate-900 dark:text-white">🎁 {t.title}</h1>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">{t.subtitle}</p>

          <form onSubmit={onSubmit} className="mt-6 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.placeholder}
              maxLength={40}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 font-mono text-sm tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              <Search className="h-4 w-4" /> {loading ? t.checking : t.check}
            </button>
          </form>
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

          {card && (
            <div className="mt-8 space-y-5">
              <GiftCardVisual
                design={card.design}
                amountLabel={formatGel(card.initialAmount)}
                recipientName={card.recipientName}
                senderName={card.senderName}
                message={card.message}
                code={card.code}
                lang={lang}
              />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.balance}</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">{formatGel(card.balance)} ₾</p>
                    <p className="text-xs text-slate-500">
                      {t.of}: {formatGel(card.initialAmount)} ₾
                      {card.expiresAt && (
                        <>
                          {' · '}
                          {t.validUntil}: {new Date(card.expiresAt).toLocaleDateString(dateLocale)}
                        </>
                      )}
                    </p>
                  </div>
                  <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-400">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t.copied : t.copy}
                  </button>
                </div>
                {!card.isActive && <p className="mt-3 text-sm font-semibold text-red-600">{t.inactive}</p>}
                {card.isActive && card.balance <= 0 && <p className="mt-3 text-sm font-semibold text-amber-600">{t.empty}</p>}
                <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.howTitle}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t.how}</p>
                </div>
                {card.suggestedItem && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <span>
                      🎯 {t.suggested}: <strong>{card.suggestedItem}</strong>
                    </span>
                    {card.suggestedUrl && (
                      <Link href={card.suggestedUrl} className="shrink-0 font-bold underline">
                        {t.open}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {card.isActive && card.balance > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{t.shop}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {shopLinks.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3.5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 no-underline hover:border-indigo-400"
                      >
                        <Icon className="h-4 w-4 text-indigo-600" /> {label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
            {t.buyOne}{' '}
            <Link href="/gift-cards" className="font-bold text-indigo-600 hover:underline">
              {t.buyLink}
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
