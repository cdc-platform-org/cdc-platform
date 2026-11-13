/**
 * Homepage hero: ambient background video, headline, CTAs and stats.
 */
import Link from 'next/link';
import { Play } from 'lucide-react';
import { HomepageContent } from '../../types/siteContent';
import { Tutorial } from '../../types/tutorial';
import type { TFunction } from 'i18next';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

interface HeroSectionProps {
  t: TFunction<"home", undefined>;
  cms: HomepageContent | null;
  translate: (geo: React.ReactNode, eng: React.ReactNode) => ReactNode;
  promoVideo: Tutorial | null;
  setShowPromoVideo: Dispatch<SetStateAction<boolean>>;
}

export default function HeroSection({ t, cms, translate, promoVideo, setShowPromoVideo }: HeroSectionProps) {
  return (
    <>
      {/* 🎬 HERO SECTION — left-aligned content on lg+, full-bleed ambient video background below lg */}
      {/* `z-0` is load-bearing: it makes this section its own stacking context
          so the z-10 scrim and z-20 header INSIDE it are ranked against each
          other only, not hoisted into the root stacking context where they'd
          compete with the nav's z-50 and the About Us dropdown's z-[60].
          Without it (position:relative + z-index:auto forms no stacking
          context) any future hero layer above z-50 would cover the dropdown. */}
      {/* -mx-4 sm:-mx-6 exactly cancels _app.tsx's app-shell px-4/sm:px-6 gutter
          — every other page section respects that gutter, but a hero
          background is expected to bleed to the true viewport edge. A plain
          block element's default width already fills its container's content
          box; negative margins here just extend that box back out past the
          parent's padding, no `w-full`/width override needed. */}
      <div className="relative z-0 -mx-4 sm:-mx-6 overflow-hidden min-h-[60vh] sm:min-h-[75vh] lg:min-h-[92vh] flex items-center bg-slate-950">
        {/* Background video — purely ambient (no controls, no pointer events, not
            focusable), always fills the full hero without letterboxing. On lg+ the
            scrim below only darkens the left text column, revealing it crisply on
            the right; below lg it's the sole background layer under the content. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Self-hosted MP4 — genuinely chrome-free (no YouTube UI to fight
              with) and loops natively via the `loop` attribute. */}
          <video
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            src="/videos/hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        </div>

        {/* Ambient scrim: kept as light as possible so the video plays bright
            and clearly — just enough of a dark base to keep white text
            legible, not a heavy cover. Below lg (no split layout) it's a
            single flat scrim across the whole section for even legibility;
            at lg+ it's a much lighter left-to-right reveal, mostly
            transparent past the text column, so the video/instructor on the
            right stays bright and crisp. No card, no backdrop-blur on the
            video itself. Text below carries a drop-shadow as extra
            legibility insurance now that the scrim is this light. */}
        <div className="absolute inset-0 z-10 bg-slate-950/40 lg:bg-gradient-to-r lg:from-slate-950/55 lg:via-slate-950/10 lg:to-transparent" />

        <header className="relative z-20 w-full max-w-7xl mx-auto px-5 sm:px-10 lg:px-16 py-8 sm:py-12 lg:py-16 text-left flex flex-col justify-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-10">
            <div className="lg:col-span-7 lg:max-w-[700px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] outline-none hover:outline-none focus:outline-none border-none hover:border-none hover:shadow-none hover:ring-0">
              {/* Badge — subtle glow ring added alongside the existing
                  glassmorphism (backdrop-blur + translucent border/fill) for
                  a more premium feel at rest, not just on hover. */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 lg:px-5 lg:py-2.5 rounded-full text-xs lg:text-sm font-black tracking-wider mb-4 sm:mb-7 border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
                {t('heroBadge')}
              </div>

              {/* Heading — CMS override renders as plain text (no gradient
                  highlight word); the default keeps the styled version. */}
              {/* Inline line-height (not a `leading-*` utility): this custom
                  local heading font's own metrics make its browser-default
                  "normal" line-height render far looser than any of
                  Tailwind's leading-* classes reliably override here, and
                  1.2 is the same proven-safe floor JobsDashboard.tsx already
                  uses for a Georgian <h1> in this heading font (descenders
                  on ვ/ჯ/ყ/ღ/პ/ხ get clipped below that). */}
              <h1 style={{ lineHeight: 1.2 }} className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-white mb-4 sm:mb-6 outline-none hover:outline-none focus:outline-none border-none hover:border-none hover:shadow-none hover:ring-0">
                {cms?.heroTitleKa || cms?.heroTitleEn
                  ? translate(cms.heroTitleKa || cms.heroTitleEn, cms.heroTitleEn || cms.heroTitleKa)
                  : <>{t('heroHeadingBefore')} <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{t('heroHeadingHighlight')}</span> {t('heroHeadingAfter')}</>}
              </h1>

              {/* Job placement subtitle */}
              <p className="text-base sm:text-xl lg:text-2xl font-semibold text-cyan-400 mb-4 sm:mb-6">
                {cms?.heroSubtitleKa || cms?.heroSubtitleEn
                  ? translate(cms.heroSubtitleKa || cms.heroSubtitleEn, cms.heroSubtitleEn || cms.heroSubtitleKa)
                  : t('heroSubtitle')}
              </p>

              {/* Description */}
              <p className="text-sm sm:text-base lg:text-xl text-slate-200/90 text-left leading-relaxed mb-5 sm:mb-9 font-medium">
                {t('heroDescription')}
              </p>

              {/* CTA — primary (browse courses) + secondary (register), matching
                  the two-button hero pattern from the Stitch design reference.
                  justify-start (not -center) keeps the row anchored to the
                  same left edge as the heading/paragraphs above it. */}
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch justify-start gap-3">
                <a
                  href="#courses"
                  className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black px-6 py-3.5 sm:px-8 sm:py-4 lg:px-9 lg:py-4 rounded-full text-sm lg:text-base tracking-wide no-underline shadow-lg shadow-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/40 hover:scale-105 transition-all duration-300 w-full sm:w-auto text-center sm:whitespace-nowrap"
                >
                  {t('heroCtaCourses')}
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </a>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md text-white font-black px-6 py-3.5 sm:px-8 sm:py-4 lg:px-9 lg:py-4 rounded-full text-sm lg:text-base tracking-wide no-underline shadow-[0_0_20px_-6px_rgba(255,255,255,0.25)] hover:bg-white/20 hover:border-white/30 transition-all duration-300 w-full sm:w-auto text-center sm:whitespace-nowrap"
                >
                  {t('heroCtaJoin')}
                </Link>
                {/* Only rendered once an admin has actually featured a
                    tutorial (/admin/tutorials) — never a placeholder for a
                    video that doesn't exist yet. */}
                {promoVideo && (
                  <button
                    type="button"
                    onClick={() => setShowPromoVideo(true)}
                    className="inline-flex items-center justify-center gap-2 bg-transparent border border-white/30 text-white font-black px-6 py-3.5 sm:px-8 sm:py-4 lg:px-9 lg:py-4 rounded-full text-sm lg:text-base tracking-wide cursor-pointer hover:bg-white/10 hover:border-white/50 transition-all duration-300 w-full sm:w-auto text-center sm:whitespace-nowrap"
                  >
                    <Play size={16} className="fill-current" />
                    {t('heroCtaWatchDemo')}
                  </button>
                )}
              </div>
            </div>
            {/* lg:col-span-5 intentionally left empty — this is where the video reads clearly */}
          </div>
        </header>
      </div>
    </>
  );
}
