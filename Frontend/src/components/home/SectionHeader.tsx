/**
 * Shared homepage section heading (2026-11 redesign): title + optional
 * subtitle on the left, optional "view all" style action on the right —
 * the layout used across the Figma e-learning template the redesign is
 * inspired by. Colours come from the cdc-* tokens (tailwind.config.js), so
 * it needs no dark-mode branches.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  action?: { href: string; label: ReactNode };
  center?: boolean;
  id?: string;
}

export default function SectionHeader({ title, subtitle, eyebrow, action, center, id }: SectionHeaderProps) {
  return (
    <div
      className={`mb-8 sm:mb-12 flex flex-col gap-5 ${
        center ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'
      }`}
    >
      <div className={center ? 'max-w-2xl' : 'max-w-3xl'}>
        {eyebrow && <span className="cdc-eyebrow mb-4">{eyebrow}</span>}
        {/* Inline line-height: Georgian descenders (ვ/ჯ/ყ/ღ/პ/ხ) clip below ~1.2. */}
        <h2 id={id} style={{ lineHeight: 1.25 }} className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight text-cdc-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-3 text-sm sm:text-base leading-relaxed text-cdc-muted">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="vip-btn-secondary shrink-0 self-start md:self-auto no-underline">
          {action.label}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
