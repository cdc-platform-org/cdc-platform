import { GiftCardDesign } from '../../services/giftCardService';

// The one gift card artwork, used everywhere: live preview while buying,
// the recipient's redeem page, the buyer's dashboard and the printable
// card. Pure CSS (no images) so it prints crisply and loads instantly.
// The email version (Backend emailService.buildGiftCardEmailHtml) mirrors
// these same four themes.
export const GIFT_THEMES: Record<GiftCardDesign, { bg: string; accent: string; emoji: string; ka: string; en: string; swatch: string }> = {
  classic: {
    bg: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#a855f7 100%)',
    accent: '#c7d2fe',
    emoji: '🎁',
    ka: 'სასაჩუქრე ბარათი',
    en: 'Gift card',
    swatch: 'linear-gradient(135deg,#4f46e5,#a855f7)',
  },
  birthday: {
    bg: 'linear-gradient(135deg,#ec4899 0%,#f43f5e 50%,#f97316 100%)',
    accent: '#fde68a',
    emoji: '🎂',
    ka: 'გილოცავ დაბადების დღეს!',
    en: 'Happy birthday!',
    swatch: 'linear-gradient(135deg,#ec4899,#f97316)',
  },
  celebration: {
    bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%)',
    accent: '#facc15',
    emoji: '✨',
    ka: 'გილოცავ!',
    en: 'Congratulations!',
    swatch: 'linear-gradient(135deg,#0f172a,#a16207)',
  },
  kids: {
    bg: 'linear-gradient(135deg,#06b6d4 0%,#14b8a6 50%,#22c55e 100%)',
    accent: '#fef08a',
    emoji: '🧸',
    ka: 'საჩუქარი შენთვის',
    en: 'A gift for you',
    swatch: 'linear-gradient(135deg,#06b6d4,#22c55e)',
  },
};

interface Props {
  design: GiftCardDesign;
  amountLabel: string;
  recipientName?: string | null;
  senderName?: string | null;
  message?: string | null;
  code?: string | null;
  lang: 'ka' | 'en';
  className?: string;
}

export default function GiftCardVisual({ design, amountLabel, recipientName, senderName, message, code, lang, className = '' }: Props) {
  const theme = GIFT_THEMES[design] ?? GIFT_THEMES.classic;
  return (
    <div
      className={`gift-card-visual relative overflow-hidden rounded-[22px] text-white shadow-2xl shadow-indigo-900/20 aspect-[1.586/1] w-full ${className}`}
      // Container units: text scales with the card itself (300px dashboard
      // thumbnail or 520px print card), not with the viewport.
      style={{ background: theme.bg, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', containerType: 'inline-size' }}
    >
      {/* soft decorative shapes */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-white/[0.07]" />
      <div className="pointer-events-none absolute top-0 bottom-0 right-[22%] w-10 bg-white/[0.12]" />
      <div className="pointer-events-none absolute left-0 right-0 top-[38%] h-10 bg-white/[0.12]" />

      <div className="relative flex h-full flex-col justify-between p-[6%]">
        <div className="flex items-start justify-between">
          <span className="font-black tracking-[0.12em] text-[4.4cqw]">CDC</span>
          <span className="text-[2.2cqw] font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
            Gift Card
          </span>
        </div>

        <div>
          <p className="text-[2.9cqw] font-semibold" style={{ color: theme.accent }}>
            {theme.emoji} {lang === 'ka' ? theme.ka : theme.en}
          </p>
          <p className="font-black leading-none text-[13cqw]">
            {amountLabel}
            <span className="ml-1 text-[0.5em] align-top">₾</span>
          </p>
          {(recipientName || senderName) && (
            <p className="mt-1.5 text-[2.6cqw] text-white/85 truncate">
              {recipientName && <>{lang === 'ka' ? 'ვის: ' : 'To: '}<strong>{recipientName}</strong></>}
              {recipientName && senderName && ' · '}
              {senderName && <>{lang === 'ka' ? 'ვისგან: ' : 'From: '}<strong>{senderName}</strong></>}
            </p>
          )}
          {message && (
            <p className="mt-2 line-clamp-2 rounded-xl bg-white/15 px-[2.4cqw] py-[1.1cqw] text-[2.5cqw] italic text-white/95">“{message}”</p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          {code ? (
            <span className="rounded-lg bg-white px-[2.4cqw] py-[1.2cqw] font-mono text-[3.6cqw] font-extrabold tracking-[0.14em] text-slate-900">{code}</span>
          ) : (
            <span className="rounded-lg border border-dashed border-white/50 px-[2.4cqw] py-[1.2cqw] font-mono text-[3.6cqw] tracking-[0.14em] text-white/70">
              GIFT-XXXX-XXXX
            </span>
          )}
          <span className="text-[2cqw] text-white/70 text-right">cdc.org.ge</span>
        </div>
      </div>
    </div>
  );
}
