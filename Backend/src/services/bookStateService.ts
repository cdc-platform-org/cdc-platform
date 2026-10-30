import { BookStatus, BookPdfStatus, BookLanguage, BookGenerationOperationType } from '@prisma/client';

// ============================================================
// CDC Custom AI Children's Book — Batch A state/domain foundation.
//
// Deliberately NOT a database service: every export here is a pure
// function over plain data. No Prisma client, no I/O, no side effects.
// Atomic DB-level claims (the guarded `updateMany` pattern the approved
// Phase 5.1 architecture specifies for revision/generation concurrency)
// belong to a later batch that actually wires this up to routes — this
// file only encodes which transitions/actions are *legal*, not how they're
// safely claimed under concurrency.
//
// Content lifecycle (`BookStatus`) and PDF artifact lifecycle
// (`BookPdfStatus`) are intentionally two independent state machines
// (Phase 5.1 correction) — never interleave a PDF-only concern into
// `BookStatus`, and never gate a content transition on `pdfStatus` except
// where this file explicitly does so (completion).
// ============================================================

// ---- Locked product constants (Phase 5/5.1 — never client-configurable) ----

// Variable page count / 1-GEL-per-page product model — replaces the
// earlier fixed "10 pages for 15 GEL" model. PAGE_COUNT no longer exists:
// every caller that used to assume a single fixed length now takes a book's
// own `pageCount` explicitly (canGeneratePdf, isValidPageNumber, the PDF/
// story-plan/final-generation services) so a 5-page and a 20-page book are
// both fully valid, distinct books rather than one being "wrong."
export const ALLOWED_PAGE_COUNTS = [5, 10, 15, 20] as const;
export type AllowedPageCount = (typeof ALLOWED_PAGE_COUNTS)[number];
export const MIN_PAGE_COUNT = 5;
export const MAX_PAGE_COUNT = 20;
export const PRICE_PER_PAGE_TETRI = 100; // 1 GEL/page, minor units
export const REVISION_LIMIT = 1;
export const SUPPORTED_LANGUAGES: readonly BookLanguage[] = ['KA', 'EN'] as const;

export function isSupportedLanguage(value: string): value is BookLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isAllowedPageCount(value: number): value is AllowedPageCount {
  return (ALLOWED_PAGE_COUNTS as readonly number[]).includes(value);
}

// Fails closed (throws) rather than returning a guessed/clamped price for
// an invalid page count — a caller must never silently charge the wrong
// amount. The DB's own `priceGel = pageCount * 100` CHECK constraint is the
// second, independent layer of defense against a corrupted/bypassed value.
export class InvalidPageCountError extends Error {
  constructor(pageCount: number) {
    super(`pageCount must be one of ${ALLOWED_PAGE_COUNTS.join(', ')}, got ${pageCount}.`);
    this.name = 'InvalidPageCountError';
  }
}

export function calculateBookPrice(pageCount: number): number {
  if (!isAllowedPageCount(pageCount)) throw new InvalidPageCountError(pageCount);
  return pageCount * PRICE_PER_PAGE_TETRI;
}

// Global bound (matches the DB's book_pages_pageNumber_check, 1..MAX_PAGE_COUNT)
// — a page number can be structurally valid yet still wrong for a
// particular book (e.g. page 12 of a 10-page book), which is why every real
// caller (final generation, revision, PDF assembly) passes the book's own
// pageCount here rather than relying on this global bound alone.
export function isValidPageNumber(pageNumber: number, pageCount: number): boolean {
  return Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= pageCount;
}

// ---- BookStatus transition table ----
//
// REVISION_QA's pass/fail distinction is deliberately NOT two different
// target statuses — both outcomes land back at FINAL_READY. A pass
// additionally flips `revisionUsed=true` and `pdfStatus='STALE'` as a
// side channel (see bookStateService.test.ts and the service that will
// perform the actual atomic update in a later batch); a fail leaves both
// untouched. This mirrors "simplify where appropriate" from the approved
// architecture rather than adding a 16th status value for a distinction
// already fully captured by revisionUsed/pdfStatus.
//
// FAILED is reached only from the two stages that genuinely have a
// book-level failure concept (character preview generation, and the
// overall final-generation run exhausting its retry budget) — per-page
// retries during FINAL_GENERATING do NOT move the book to FAILED; the
// book simply stays in FINAL_GENERATING while individual pages retry
// (see FINAL_QA → FINAL_GENERATING below, the per-page-retry loop).
const VALID_TRANSITIONS: Record<BookStatus, readonly BookStatus[]> = {
  DRAFT: ['STORY_PLAN_READY'],
  STORY_PLAN_READY: ['CHARACTER_PREVIEW_GENERATING'],
  CHARACTER_PREVIEW_GENERATING: ['CHARACTER_PREVIEW_READY', 'FAILED'],
  CHARACTER_PREVIEW_READY: ['CHARACTER_APPROVED'],
  CHARACTER_APPROVED: ['PAYMENT_PENDING'],
  // PAID is set only by a verified payment webhook (never by this service,
  // never by a client flag) — see Phase 5.1 §Payment Security. A failed/
  // cancelled payment returns to CHARACTER_APPROVED so the user can retry
  // checkout, rather than a book-level FAILED (this isn't a generation
  // failure).
  PAYMENT_PENDING: ['PAID', 'CHARACTER_APPROVED'],
  PAID: ['FINAL_GENERATING'],
  FINAL_GENERATING: ['FINAL_QA', 'FAILED'],
  // FINAL_QA -> FINAL_GENERATING is the per-page-retry loop (one or more
  // of the 10 pages didn't pass QA yet); FINAL_QA -> FINAL_READY is
  // reached once all 10 pages have an accepted artifact.
  FINAL_QA: ['FINAL_READY', 'FINAL_GENERATING'],
  FINAL_READY: ['REVISION_REQUESTED', 'COMPLETED'],
  REVISION_REQUESTED: ['REVISION_GENERATING'],
  REVISION_GENERATING: ['REVISION_QA', 'FINAL_READY'],
  REVISION_QA: ['FINAL_READY'],
  // A completed book may still receive its one revision claim.
  COMPLETED: ['REVISION_REQUESTED'],
  // Bounded retry back into whichever stage failed — the caller (a later
  // batch) decides which, this table only says both are legal recoveries
  // from FAILED.
  FAILED: ['CHARACTER_PREVIEW_GENERATING', 'FINAL_GENERATING'],
};

export function isValidStatusTransition(from: BookStatus, to: BookStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidNextStatuses(from: BookStatus): readonly BookStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

// ---- Eligibility guards ----
//
// Every function below answers "is this action currently legal," given
// plain data — no Prisma, no lookups. A later batch is responsible for
// performing the actual atomic DB claim (guarded `updateMany` +
// count-check, per Phase 5.1) before acting on a `true` result here; a
// `true` here is a necessary, not sufficient, condition under concurrency.

export function canApproveCharacter(book: { status: BookStatus }): boolean {
  return book.status === 'CHARACTER_PREVIEW_READY';
}

export function canInitiatePayment(book: { status: BookStatus }): boolean {
  return book.status === 'CHARACTER_APPROVED';
}

// FINAL_PAGE_GENERATION_ALLOWED (Phase 5 §9 / Phase 5.1 unchanged):
// status must be PAID (first entry) or FINAL_GENERATING (a resumed/
// retried run), AND the three immutable locked snapshots must all exist.
// Ownership/auth checks are the route layer's job, not this pure function.
export function canStartFinalGeneration(book: {
  status: BookStatus;
  characterBible: unknown;
  styleBible: unknown;
  storyPlan: unknown;
}): boolean {
  const statusOk = book.status === 'PAID' || book.status === 'FINAL_GENERATING';
  return statusOk && book.characterBible != null && book.styleBible != null && book.storyPlan != null;
}

// Revision claim eligibility (Phase 5.1 §Corrected Revision Concurrency):
// this is the PRECONDITION the atomic claim's WHERE clause encodes — this
// function and that WHERE clause must never drift apart.
export function canClaimRevision(book: { status: BookStatus; revisionUsed: boolean }): boolean {
  return (book.status === 'FINAL_READY' || book.status === 'COMPLETED') && book.revisionUsed === false;
}

// PDF generation/retry eligibility (Phase 5.1 §Corrected PDF Lifecycle):
// exactly PAGE_COUNT accepted pages, content status in a stable
// post-generation state, and pdfStatus not already mid-flight/current.
export function canGeneratePdf(params: {
  acceptedPageCount: number;
  pageCount: number;
  status: BookStatus;
  pdfStatus: BookPdfStatus;
}): boolean {
  const contentOk = params.status === 'FINAL_READY' || params.status === 'COMPLETED';
  const pdfOk = params.pdfStatus === 'NONE' || params.pdfStatus === 'STALE' || params.pdfStatus === 'FAILED';
  return params.acceptedPageCount === params.pageCount && contentOk && pdfOk;
}

// Completion requires a CURRENT pdf — never inferred from content status
// alone (Phase 5.1 §Corrected PDF Lifecycle: "status=COMPLETED requires
// pdfStatus=CURRENT").
export function canComplete(params: { pdfStatus: BookPdfStatus }): boolean {
  return params.pdfStatus === 'CURRENT';
}

// ---- Generation idempotency: logical operation identity ----
//
// Stable across retries of the SAME logical unit of work — pairs with
// BookGenerationEvent's (logicalOperationKey, attemptNumber) unique
// constraint (Phase 5.1 §Corrected Generation Idempotency Model). Two
// calls with identical inputs MUST return the identical string — this is
// a pure, deterministic function, never random/time-based.
export function buildLogicalOperationKey(params: {
  bookProjectId: string;
  operationType: BookGenerationOperationType;
  pageNumber: number | null;
  revisionVersion: number;
}): string {
  const page = params.pageNumber === null ? 'none' : String(params.pageNumber);
  return `${params.bookProjectId}:${params.operationType}:${page}:${params.revisionVersion}`;
}

// ---- Immutability contract ----
//
// Documents (does not itself enforce — there is no setter to guard yet in
// Batch A) which BookProject fields become locked, and at what point. A
// later batch's write paths must consult this, not reimplement the list.

/** Locked the moment CHARACTER_APPROVED is reached — never rewritten after. */
export const FIELDS_LOCKED_AT_CHARACTER_APPROVAL = [
  'characterBible',
  'characterBibleVersion',
  'styleBible',
  'illustrationStyle',
] as const;

/** Locked once payment is initiated / final generation begins — never rewritten after. */
export const FIELDS_LOCKED_AT_PAYMENT_OR_GENERATION = [
  'priceGel',
  'pageCount',
  'revisionLimit',
  'language',
  'finalQuality',
] as const;
