import { BOOK_FORCE_REAL_AI, ENABLE_BOOK_DEV_PAYMENT_SIMULATION, BOOK_USE_CLOUD_STORAGE } from '../utils/env';

// ============================================================
// Children's Book — single source of truth for "are we mocking AI / is dev
// payment simulation armed" so every route/service asks here instead of
// re-deriving the NODE_ENV check itself. Production ALWAYS gets real AI and
// NEVER gets dev payment simulation, no matter what the env vars say — the
// NODE_ENV guard is hard-coded below, not just "the default."
// ============================================================

export function isBookAiMocked(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return !BOOK_FORCE_REAL_AI;
}

export function isBookDevPaymentSimulationEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return ENABLE_BOOK_DEV_PAYMENT_SIMULATION;
}

export function shouldUseCloudBookStorage(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return BOOK_USE_CLOUD_STORAGE;
}

// Real-money checkout amount for one specific BookProject, for a controlled
// local BOG payment QA test — NEVER the normal path. Hard-forced off in
// production. Returns `listPriceTetri` (the normal 15 GEL / 1500 tetri
// price) unless ALL of: non-production, BOOK_QA_DISCOUNT_BOOK_ID is set,
// it exactly matches `bookId`, and BOOK_QA_DISCOUNT_AMOUNT_TETRI is a
// positive integer strictly less than the list price (never a surprise
// upcharge, never zero/free). BookProject.priceGel itself is never
// touched by this — only what gets sent to BOG/stored on the BogPayment
// row for this one checkout.
//
// Reads process.env directly here (not the frozen env.ts constants
// BOOK_QA_DISCOUNT_BOOK_ID/BOOK_QA_DISCOUNT_AMOUNT_TETRI — still exported
// from env.ts purely as documentation of what this reads) so this one
// narrow, explicitly temporary QA override is simple to unit-test by
// mutating process.env directly, same as how it'd actually be set for a
// one-off local test. Every other flag in this file intentionally stays
// frozen-at-import, matching the rest of the codebase's env-var convention.
export function resolveBookPayableAmountTetri(bookId: string, listPriceTetri: number): number {
  if (process.env.NODE_ENV === 'production') return listPriceTetri;
  const discountBookId = process.env.BOOK_QA_DISCOUNT_BOOK_ID;
  if (!discountBookId || discountBookId !== bookId) return listPriceTetri;
  const discounted = process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI ? Number(process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI) : undefined;
  if (!discounted || !Number.isInteger(discounted) || discounted <= 0 || discounted >= listPriceTetri) return listPriceTetri;
  return discounted;
}
