// Content for /privacy, /terms, /refund-policy — kept as data (not inline
// JSX) so legal copy can be updated without touching page/layout code.
// See merchantInfo.ts for the entity block these pages also display.
//
// NOTE: this is template legal copy describing how the platform actually
// works (BOG + Stripe payments, 20%/25% commission, 60-day deletion grace,
// 365-day gift cards, etc.). It has not been reviewed by a lawyer: have
// Georgian legal counsel review it before relying on it for compliance.
//
// Only ka and en are maintained. The other site locales show the English
// text with a short notice (see pages/terms.tsx): an outdated machine
// translation of legal terms is worse than a current English one.
//
// When a business rule changes (commission, refund window, verification
// benefits, gift-card validity), update terms.ts, refund.ts and, for
// verification, src/components/shared/VerificationBenefits.tsx together.

export { privacyPolicy } from './privacy';
export { termsAndConditions } from './terms';
export { refundPolicy } from './refund';

export const lastUpdated = '2026-11-14';

export type FullLocale = 'ka' | 'en' | 'de' | 'es' | 'fr' | 'uk' | 'tr' | 'hy' | 'az';
