// Inline SVG country flags for the language switcher.
//
// Emoji flags (🇬🇪, 🇬🇧 …) are NOT used on purpose: Windows has no emoji
// flag glyphs, so every browser on Windows rendered them as the bare
// two-letter region code ("GE", "GB", …). Inline SVGs render the same
// everywhere and need no extra package or network request.
//
// All flags share one 3:2 viewBox (30x20) so they line up in the menu.
// Designs are simplified to stay legible at ~20px wide (e.g. Spain's flag
// omits the coat of arms).

type FlagCode = 'ka' | 'en' | 'de' | 'es' | 'fr' | 'uk' | 'tr' | 'hy' | 'az';

function GeorgiaFlag() {
  // Small "bolnur-katskhuri" crosses, one per quarter.
  const small = (cx: number, cy: number) => (
    <path
      key={`${cx}-${cy}`}
      fill="#ff0000"
      d={`M${cx - 0.6} ${cy - 2.2}h1.2v1.6h1.6v1.2h-1.6v1.6h-1.2v-1.6h-1.6v-1.2h1.6z`}
    />
  );
  return (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect x="13" width="4" height="20" fill="#ff0000" />
      <rect y="8" width="30" height="4" fill="#ff0000" />
      {small(6.5, 4)}
      {small(23.5, 4)}
      {small(6.5, 16)}
      {small(23.5, 16)}
    </>
  );
}

function UkFlag() {
  return (
    <>
      {/* The <svg> viewport already clips overflow, so no clipPath (and no
          id that could collide when several flags are on one page). */}
      <g>
        <rect width="30" height="20" fill="#012169" />
        <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.4" />
        <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
        <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.4" />
      </g>
    </>
  );
}

function TricolorH({ colors }: { colors: [string, string, string] }) {
  return (
    <>
      <rect width="30" height="6.67" fill={colors[0]} />
      <rect y="6.67" width="30" height="6.66" fill={colors[1]} />
      <rect y="13.33" width="30" height="6.67" fill={colors[2]} />
    </>
  );
}

function CrescentStar({
  cx,
  cy,
  r,
  bg,
  starX,
}: {
  cx: number;
  cy: number;
  r: number;
  bg: string;
  starX: number;
}) {
  // Five-pointed star centred at (starX, cy), pointing left like on the
  // Turkish and Azerbaijani flags.
  const s = r * 0.42;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? s : s * 0.4;
    return `${(starX + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <circle cx={cx + r * 0.25} cy={cy} r={r * 0.8} fill={bg} />
      <polygon points={pts} fill="#fff" />
    </>
  );
}

function FlagShapes({ code }: { code: FlagCode }) {
  switch (code) {
    case 'ka':
      return <GeorgiaFlag />;
    case 'en':
      return <UkFlag />;
    case 'de':
      return <TricolorH colors={['#000', '#DD0000', '#FFCE00']} />;
    case 'es':
      return (
        <>
          <rect width="30" height="20" fill="#AA151B" />
          <rect y="5" width="30" height="10" fill="#F1BF00" />
        </>
      );
    case 'fr':
      return (
        <>
          <rect width="10" height="20" fill="#002654" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#CE1126" />
        </>
      );
    case 'uk':
      return (
        <>
          <rect width="30" height="10" fill="#0057B7" />
          <rect y="10" width="30" height="10" fill="#FFD700" />
        </>
      );
    case 'tr':
      return (
        <>
          <rect width="30" height="20" fill="#E30A17" />
          <CrescentStar cx={11} cy={10} r={5} bg="#E30A17" starX={17.2} />
        </>
      );
    case 'hy':
      return <TricolorH colors={['#D90012', '#0033A0', '#F2A800']} />;
    case 'az':
      return (
        <>
          <TricolorH colors={['#00B5E2', '#EF3340', '#509E2F']} />
          <CrescentStar cx={14} cy={10} r={2.6} bg="#EF3340" starX={17.6} />
        </>
      );
    default:
      return null;
  }
}

export default function FlagIcon({
  code,
  className = '',
}: {
  code: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      className={`inline-block w-5 h-[13px] shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15 ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <FlagShapes code={code as FlagCode} />
    </svg>
  );
}
