/**
 * Purchase card on the course detail page: price (with sale/promo strike-
 * through), enroll / continue / sold-out button, refund note and promo-code
 * field. 2026-11 redesign (EDUPRO style): sticky white card in the right
 * column on desktop; on phones the page also shows a fixed bottom CTA bar
 * (CourseMobileCta). Checkout logic stays in pages/courses/[id]/index.tsx.
 */
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { Course } from '../../../types/lms';
import { PromoValidationResult } from '../../../services/paymentService';
import { formatPrice, getSaleCountdownLabel } from '../../../utils/coursePricing';

type T = TFunction<'courses', undefined>;

export function formatPromoDiscount(promo: PromoValidationResult): string {
  if (promo.discountPercent) return `-${promo.discountPercent}%`;
  if (promo.discountAmount) return `-${formatPrice(promo.discountAmount)}`;
  return '';
}

interface CtaProps {
  course: Course;
  t: T;
  enrolled: boolean;
  processing: boolean;
  effectivePrice: number;
  onEnroll: () => void;
  className?: string;
}

/** The main action button, shared by the card and the mobile bottom bar. */
export function CourseCtaButton({ course, t, enrolled, processing, effectivePrice, onEnroll, className = '' }: CtaProps) {
  const base = `inline-flex items-center justify-between gap-3 rounded-full pl-6 pr-1.5 py-1.5 text-base font-bold no-underline ${className}`;
  const circle = (
    <span className="w-10 h-10 shrink-0 rounded-full bg-white text-cdc-primary flex items-center justify-center" aria-hidden="true">
      <ArrowRight className="w-5 h-5" />
    </span>
  );
  if (enrolled) {
    return (
      <Link href={`/courses/${course.id}/learn`} className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}>
        {t('continueLearning')}
        {circle}
      </Link>
    );
  }
  if (course.isFull) {
    return <span className={`${base} justify-center pr-6 py-3.5 bg-cdc-bg text-cdc-muted cursor-not-allowed`}>{t('soldOut')}</span>;
  }
  const label = processing
    ? effectivePrice === 0 ? t('activating') : t('detailEnrolling')
    : effectivePrice === 0 ? t('enrollFree') : `${String(t('enroll')).replace(/\s*→\s*$/, '')} · ${formatPrice(effectivePrice)}`;
  return (
    <button type="button" onClick={onEnroll} disabled={processing} className={`${base} border-none cursor-pointer bg-cdc-primary text-white hover:bg-cdc-primary-hover disabled:opacity-60`}>
      {label}
      {circle}
    </button>
  );
}

interface CardProps extends CtaProps {
  appliedPromo: PromoValidationResult | null;
  promoInput: string;
  setPromoInput: (v: string) => void;
  applyingPromo: boolean;
  promoError: string | null;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  lang: 'ka' | 'en';
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
}

export default function CoursePurchaseCard(p: CardProps) {
  const { course, t, enrolled, effectivePrice, appliedPromo } = p;
  const countdown = course.saleActive ? getSaleCountdownLabel(course.discountEndDate, p.lang) : null;
  return (
    <div className="vip-card hover:translate-y-0 p-6">
      {p.topSlot}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold text-cdc-ink">{formatPrice(effectivePrice)}</span>
        {(course.saleActive || appliedPromo) && <s className="text-lg text-cdc-muted">{formatPrice(course.originalPrice)}</s>}
        {course.saleActive && (
          <span className="ml-auto text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-rose-600">
            {course.discountBadgeText || `-${course.discountPercent}% ${t('saleOffSuffix')}`}
          </span>
        )}
      </div>
      {countdown && <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400">⏳ {countdown}</p>}

      <CourseCtaButton {...p} className="mt-5 w-full" />

      {!enrolled && effectivePrice > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400" title={t('refundGuaranteeDetail') as string}>
          <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {t('refundGuarantee')}
        </p>
      )}

      {!enrolled && (
        <div className="mt-5 pt-5 border-t border-cdc-border">
          {appliedPromo ? (
            <div className="flex items-center gap-2 flex-wrap text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">✓ {t('promoApplied')}: {appliedPromo.code}</span>
              {formatPromoDiscount(appliedPromo) && (
                <span className="font-bold text-[11px] text-white bg-emerald-600 px-2 py-0.5 rounded-full">{formatPromoDiscount(appliedPromo)}</span>
              )}
              <button type="button" onClick={p.onRemovePromo} className="ml-auto text-emerald-700 dark:text-emerald-400 bg-transparent border-none cursor-pointer underline">
                {t('promoRemove')}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-cdc-ink mb-2">{t('promoLabel')}</p>
              <div className="flex items-center gap-2">
                <input
                  value={p.promoInput}
                  onChange={(e) => p.setPromoInput(e.target.value)}
                  placeholder={t('promoPlaceholder')}
                  className="flex-1 min-w-0 rounded-xl border border-cdc-border bg-cdc-surface px-3 py-2.5 text-sm text-cdc-ink placeholder:text-cdc-muted focus:outline-none focus:ring-2 focus:ring-cdc-primary/40"
                />
                <button type="button" onClick={p.onApplyPromo} disabled={p.applyingPromo || !p.promoInput.trim()} className="vip-btn-secondary px-4 cursor-pointer disabled:opacity-50">
                  {p.applyingPromo ? t('promoApplying') : t('promoApply')}
                </button>
              </div>
            </div>
          )}
          {p.promoError && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{p.promoError}</p>}
        </div>
      )}
      {p.bottomSlot}
    </div>
  );
}

/** Fixed bottom CTA on phones/tablets (sits above the mobile tab bar). */
export function CourseMobileCta(props: CtaProps) {
  return (
    <div className="lg:hidden fixed left-0 right-0 z-40 px-4 pb-3 pt-3 bg-gradient-to-t from-cdc-bg via-cdc-bg/95 to-transparent" style={{ bottom: 'var(--tabbar-h, 0px)' }}>
      <CourseCtaButton {...props} className="w-full shadow-card-hover" />
    </div>
  );
}
