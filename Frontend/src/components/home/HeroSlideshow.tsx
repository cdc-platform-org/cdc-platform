/**
 * Home page cover slideshow: CDC event photos that crossfade automatically
 * (with a slow zoom) inside the hero's rounded frame.
 *
 * Why it's built this way:
 * - Photos are self-hosted WebP in public/images/hero/ (1600w + 800w for
 *   phones), served by our own CDN — never hotlinked from Cloudinary.
 * - Only the current and the next photo are mounted, so the page loads one
 *   image up front instead of all 31.
 * - Pauses while the tab is hidden or the pointer is over it, and holds on
 *   the first photo for visitors who prefer reduced motion.
 */
import { useEffect, useState } from 'react';

const PHOTO_COUNT = 31;
const INTERVAL_MS = 5000;
const FADE_MS = 1200;

const photo = (i: number) => {
  const n = String(i + 1).padStart(2, '0');
  return { src: `/images/hero/cdc-hero-${n}.webp`, srcSm: `/images/hero/cdc-hero-${n}-sm.webp` };
};

export default function HeroSlideshow({ alt }: { alt: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % PHOTO_COUNT);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion]);

  // Render previous (fading out), current and next (preloading, invisible).
  const prev = (index - 1 + PHOTO_COUNT) % PHOTO_COUNT;
  const next = (index + 1) % PHOTO_COUNT;
  const mounted = index === 0 ? [index, next] : [prev, index, next];

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="img"
      aria-label={alt}
    >
      {mounted.map((i) => {
        const { src, srcSm } = photo(i);
        const active = i === index;
        return (
          <picture key={i}>
            <source media="(max-width: 640px)" srcSet={srcSm} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static WebP, crossfaded manually */}
            <img
              src={src}
              alt=""
              aria-hidden="true"
              decoding="async"
              fetchPriority={i === 0 ? 'high' : 'low'}
              loading={i === 0 ? 'eager' : 'lazy'}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: active ? 1 : 0,
                transform: active && !reducedMotion ? 'scale(1.06)' : 'scale(1)',
                transition: `opacity ${FADE_MS}ms ease-in-out, transform ${INTERVAL_MS + FADE_MS}ms linear`,
              }}
            />
          </picture>
        );
      })}

      {/* Progress dots — show where we are without 31 tiny buttons. */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm" aria-hidden="true">
        {Array.from({ length: 5 }, (_, d) => {
          const bucket = Math.floor((index / PHOTO_COUNT) * 5);
          return <span key={d} className={`h-1.5 rounded-full transition-all duration-500 ${d === bucket ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />;
        })}
      </div>
    </div>
  );
}
