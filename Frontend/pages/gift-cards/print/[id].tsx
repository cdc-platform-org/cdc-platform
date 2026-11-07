import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Printer } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import GiftCardVisual, { GIFT_THEMES } from '../../../src/components/giftCards/GiftCardVisual';
import { getMyGiftCard, formatGel, MyGiftCard } from '../../../src/services/giftCardService';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    print: 'დაბეჭდვა / PDF-ად შენახვა',
    hint: 'ბეჭდვის ფანჯარაში აირჩიე „Save as PDF“, თუ ფაილი გინდა. ჩართე „Background graphics“, რომ ფერები გამოჩნდეს.',
    loading: 'იტვირთება…',
    notFound: 'ბარათი ვერ მოიძებნა.',
    notPaid: 'ბარათი ჯერ არ არის გადახდილი.',
    forYou: 'შენთვის',
    from: 'გილოცავს',
    howTitle: 'როგორ გამოვიყენო?',
    steps: [
      'გახსენი cdc.org.ge და აირჩიე ნებისმიერი კურსი, ლაივ ტრენინგი, ციფრული პროდუქტი ან AI საბავშვო წიგნი.',
      'გადახდისას ჩაწერე კოდი „პრომო კოდის“ ველში.',
      'თანხა ბარათიდან ჩამოიჭრება. ნაშთი შემდეგი ყიდვისთვის შეგრჩება.',
    ],
    validUntil: 'მოქმედებს',
    balanceAt: 'ნაშთის შემოწმება: cdc.org.ge/gift-cards/redeem',
    cut: 'აქ მოჭერი',
  },
  en: {
    print: 'Print / Save as PDF',
    hint: 'Choose “Save as PDF” in the print dialog for a file. Turn on “Background graphics” so the colors print.',
    loading: 'Loading…',
    notFound: 'Gift card not found.',
    notPaid: 'This gift card is not paid yet.',
    forYou: 'For you',
    from: 'With love from',
    howTitle: 'How to use it',
    steps: [
      'Go to cdc.org.ge and pick any course, live training, digital product or AI children\'s book.',
      'Enter the code in the promo code field at checkout.',
      'The amount comes off the card. Any balance is kept for next time.',
    ],
    validUntil: 'Valid until',
    balanceAt: 'Check balance: cdc.org.ge/gift-cards/redeem',
    cut: 'cut here',
  },
};

function PrintContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale) === 'ka' ? 'ka' : 'en';
  const t = dict[lang];
  const [card, setCard] = useState<MyGiftCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof router.query.id !== 'string') return;
    getMyGiftCard(router.query.id)
      .then(setCard)
      .catch(() => setError(t.notFound));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.id]);

  if (error) return <p className="p-10 text-center text-sm text-red-600">{error}</p>;
  if (!card) return <p className="p-10 text-center text-sm text-slate-500">{t.loading}</p>;
  if (!card.code) return <p className="p-10 text-center text-sm text-slate-600">{t.notPaid}</p>;

  const theme = GIFT_THEMES[card.design] ?? GIFT_THEMES.classic;

  return (
    <>
      <Head>
        <title>CDC Gift Card — {card.recipientName}</title>
        <style>{`
          @page { size: A4 portrait; margin: 12mm; }
          @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; }
            .print-sheet { box-shadow: none !important; margin: 0 auto !important; }
          }
          .gift-card-visual, .print-accent { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `}</style>
      </Head>
      <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
        <div className="no-print mx-auto mb-5 flex max-w-[720px] flex-col items-center gap-2 text-center">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-700">
            <Printer className="h-4 w-4" /> {t.print}
          </button>
          <p className="max-w-md text-xs text-slate-500">{t.hint}</p>
        </div>

        <div className="print-sheet mx-auto max-w-[720px] rounded-2xl bg-white p-8 shadow-xl sm:p-10">
          {/* Front: the card itself, at real credit-card proportions */}
          <div className="mx-auto max-w-[520px]">
            <GiftCardVisual
              design={card.design}
              amountLabel={formatGel(card.amount)}
              recipientName={card.recipientName}
              senderName={card.senderName}
              code={card.code}
              lang={lang}
            />
          </div>

          <div className="my-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            <span className="h-px flex-1 border-t border-dashed border-slate-300" /> ✂ {t.cut} <span className="h-px flex-1 border-t border-dashed border-slate-300" />
          </div>

          {/* Inside: the greeting */}
          <div className="text-center">
            <p className="print-accent text-4xl">{theme.emoji}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t.forYou}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{card.recipientName}</p>
            {card.message && <p className="mx-auto mt-5 max-w-md whitespace-pre-line text-lg italic leading-relaxed text-slate-700">“{card.message}”</p>}
            <p className="mt-5 text-sm text-slate-500">
              {t.from} <strong className="text-slate-800">{card.senderName}</strong>
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-900">{t.howTitle}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-mono text-lg font-extrabold tracking-[0.14em] text-slate-900">{card.code}</span>
              <span className="text-right text-xs font-bold text-slate-700">{formatGel(card.amount)} ₾</span>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              {card.expiresAt && `${t.validUntil}: ${new Date(card.expiresAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB')} · `}
              {t.balanceAt}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PrintGiftCardPage() {
  return (
    <ProtectedRoute>
      <PrintContent />
    </ProtectedRoute>
  );
}
