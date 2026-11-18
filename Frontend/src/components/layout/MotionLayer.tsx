/**
 * Site-wide "alive" motion layer (2026-11-19). Mounted once in pages/_app.tsx.
 * Purpose: gentle reveal-on-scroll for cards/sections, so every page feels
 * animated without editing each page. Styling lives in globals.css (.mv-*).
 * Safety: only elements that start BELOW the fold get hidden, they are always
 * revealed again by IntersectionObserver (or after a 2.5 s fallback), and
 * nothing runs under prefers-reduced-motion. Admin pages are skipped.
 * Hover/press/shine effects are pure CSS and live in globals.css.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const TARGETS = [
  '.vip-card', '.learning-course-card', '[data-reveal]',
  'section:not([data-home-hero]) > h2', 'section:not([data-home-hero]) > div > h2', 'section:not([data-home-hero]) > div > .grid > *',
].join(',');

export default function MotionLayer() {
  const { asPath } = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (asPath.startsWith('/admin')) return;

    const seen = new WeakSet<Element>();
    const timers: number[] = [];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('mv-in');
        io.unobserve(el);
        timers.push(window.setTimeout(() => el.classList.remove('mv-pre', 'mv-in'), 700));
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    const scan = () => {
      document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.95) return; // already visible: leave alone
        // small stagger for siblings in the same grid row
        const idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.setProperty('--mv-d', `${Math.min(idx % 4, 3) * 70}ms`);
        el.classList.add('mv-pre');
        io.observe(el);
        // fail-safe: never leave content hidden
        timers.push(window.setTimeout(() => el.classList.remove('mv-pre'), 6000));
      });
    };

    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); timers.forEach(clearTimeout); };
  }, [asPath]);

  return null;
}
