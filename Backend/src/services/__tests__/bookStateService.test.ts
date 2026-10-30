import {
  ALLOWED_PAGE_COUNTS,
  PRICE_PER_PAGE_TETRI,
  REVISION_LIMIT,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  isAllowedPageCount,
  calculateBookPrice,
  InvalidPageCountError,
  isValidPageNumber,
  isValidStatusTransition,
  canApproveCharacter,
  canInitiatePayment,
  canStartFinalGeneration,
  canClaimRevision,
  canGeneratePdf,
  canComplete,
  buildLogicalOperationKey,
} from '../bookStateService';

// Pure-function test suite — no Prisma client, no database, no network,
// no Azure/text-AI calls anywhere in this file.

describe('locked product constants — variable page count / 1-GEL-per-page', () => {
  it('1. supports exactly ka and en', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['KA', 'EN']);
    expect(isSupportedLanguage('KA')).toBe(true);
    expect(isSupportedLanguage('EN')).toBe(true);
  });

  it('2. rejects Russian (and any other locale)', () => {
    expect(isSupportedLanguage('RU')).toBe(false);
    expect(isSupportedLanguage('ru')).toBe(false);
    expect(isSupportedLanguage('fr')).toBe(false);
  });

  it('3. allowed page counts are exactly 5, 10, 15, 20', () => {
    expect(ALLOWED_PAGE_COUNTS).toEqual([5, 10, 15, 20]);
    expect(PRICE_PER_PAGE_TETRI).toBe(100);
  });

  it('4. accepts exactly 5/10/15/20 as allowed page counts', () => {
    for (const n of [5, 10, 15, 20]) expect(isAllowedPageCount(n)).toBe(true);
  });

  it('5. rejects every other page count, including near-boundary and wildly invalid values', () => {
    for (const n of [0, 1, 6, 9, 11, 19, 21, 100]) expect(isAllowedPageCount(n)).toBe(false);
  });

  it('6. revision limit is exactly 1, regardless of page count', () => {
    expect(REVISION_LIMIT).toBe(1);
  });

  it('calculateBookPrice: 5 → 500, 10 → 1000, 15 → 1500, 20 → 2000 tetri', () => {
    expect(calculateBookPrice(5)).toBe(500);
    expect(calculateBookPrice(10)).toBe(1000);
    expect(calculateBookPrice(15)).toBe(1500);
    expect(calculateBookPrice(20)).toBe(2000);
  });

  it('calculateBookPrice fails closed (throws) for any disallowed page count', () => {
    for (const n of [0, 1, 6, 9, 11, 19, 21, 100]) {
      expect(() => calculateBookPrice(n)).toThrow(InvalidPageCountError);
    }
  });
});

describe('BookStatus transitions', () => {
  it('rejects invalid/out-of-order transitions', () => {
    expect(isValidStatusTransition('DRAFT', 'PAID')).toBe(false);
    expect(isValidStatusTransition('PAYMENT_PENDING', 'FINAL_GENERATING')).toBe(false);
    expect(isValidStatusTransition('CHARACTER_PREVIEW_READY', 'PAID')).toBe(false);
    expect(isValidStatusTransition('COMPLETED', 'DRAFT')).toBe(false);
  });

  it('accepts the full happy-path chain', () => {
    const chain: Array<[string, string]> = [
      ['DRAFT', 'STORY_PLAN_READY'],
      ['STORY_PLAN_READY', 'CHARACTER_PREVIEW_GENERATING'],
      ['CHARACTER_PREVIEW_GENERATING', 'CHARACTER_PREVIEW_READY'],
      ['CHARACTER_PREVIEW_READY', 'CHARACTER_APPROVED'],
      ['CHARACTER_APPROVED', 'PAYMENT_PENDING'],
      ['PAYMENT_PENDING', 'PAID'],
      ['PAID', 'FINAL_GENERATING'],
      ['FINAL_GENERATING', 'FINAL_QA'],
      ['FINAL_QA', 'FINAL_READY'],
      ['FINAL_READY', 'COMPLETED'],
    ];
    for (const [from, to] of chain) {
      expect(isValidStatusTransition(from as any, to as any)).toBe(true);
    }
  });

  it('allows PAID to be set only as a destination, never skipped into', () => {
    expect(isValidStatusTransition('PAYMENT_PENDING', 'PAID')).toBe(true);
    expect(isValidStatusTransition('CHARACTER_APPROVED', 'PAID')).toBe(false);
  });

  it('allows FAILED to recover only into a genuine generating stage', () => {
    expect(isValidStatusTransition('FAILED', 'CHARACTER_PREVIEW_GENERATING')).toBe(true);
    expect(isValidStatusTransition('FAILED', 'FINAL_GENERATING')).toBe(true);
    expect(isValidStatusTransition('FAILED', 'PAID')).toBe(false);
  });

  it('allows a completed book to still receive one revision claim', () => {
    expect(isValidStatusTransition('COMPLETED', 'REVISION_REQUESTED')).toBe(true);
  });
});

describe('final generation eligibility', () => {
  it('requires PAID for the initial run', () => {
    const base = { characterBible: { x: 1 }, styleBible: { y: 1 }, storyPlan: { z: 1 } };
    expect(canStartFinalGeneration({ status: 'PAID' as any, ...base })).toBe(true);
    expect(canStartFinalGeneration({ status: 'CHARACTER_APPROVED' as any, ...base })).toBe(false);
    expect(canStartFinalGeneration({ status: 'PAYMENT_PENDING' as any, ...base })).toBe(false);
  });

  it('allows a resumed run from FINAL_GENERATING itself', () => {
    const base = { characterBible: { x: 1 }, styleBible: { y: 1 }, storyPlan: { z: 1 } };
    expect(canStartFinalGeneration({ status: 'FINAL_GENERATING' as any, ...base })).toBe(true);
  });

  it('missing Character Bible blocks final generation', () => {
    expect(
      canStartFinalGeneration({ status: 'PAID' as any, characterBible: null, styleBible: { y: 1 }, storyPlan: { z: 1 } })
    ).toBe(false);
  });

  it('missing Style Bible blocks final generation', () => {
    expect(
      canStartFinalGeneration({ status: 'PAID' as any, characterBible: { x: 1 }, styleBible: null, storyPlan: { z: 1 } })
    ).toBe(false);
  });

  it('missing Story Plan blocks final generation', () => {
    expect(
      canStartFinalGeneration({ status: 'PAID' as any, characterBible: { x: 1 }, styleBible: { y: 1 }, storyPlan: null })
    ).toBe(false);
  });
});

describe('character approval / payment initiation', () => {
  it('character approval only legal from CHARACTER_PREVIEW_READY', () => {
    expect(canApproveCharacter({ status: 'CHARACTER_PREVIEW_READY' as any })).toBe(true);
    expect(canApproveCharacter({ status: 'CHARACTER_PREVIEW_GENERATING' as any })).toBe(false);
  });

  it('payment initiation only legal from CHARACTER_APPROVED', () => {
    expect(canInitiatePayment({ status: 'CHARACTER_APPROVED' as any })).toBe(true);
    expect(canInitiatePayment({ status: 'DRAFT' as any })).toBe(false);
  });
});

describe('revision claim eligibility', () => {
  it('revisionUsed=true blocks a new revision, regardless of book length', () => {
    expect(canClaimRevision({ status: 'FINAL_READY' as any, revisionUsed: true })).toBe(false);
    expect(canClaimRevision({ status: 'COMPLETED' as any, revisionUsed: true })).toBe(false);
  });

  it('a failed revision attempt does not require revisionUsed=true — eligibility is untouched', () => {
    expect(canClaimRevision({ status: 'FINAL_READY' as any, revisionUsed: false })).toBe(true);
  });

  it('claimable from either FINAL_READY or COMPLETED, never from earlier states', () => {
    expect(canClaimRevision({ status: 'FINAL_READY' as any, revisionUsed: false })).toBe(true);
    expect(canClaimRevision({ status: 'COMPLETED' as any, revisionUsed: false })).toBe(true);
    expect(canClaimRevision({ status: 'FINAL_GENERATING' as any, revisionUsed: false })).toBe(false);
  });
});

describe('exact page-count PDF invariant, for each allowed page count', () => {
  const eligibleBase = { status: 'FINAL_READY' as any, pdfStatus: 'NONE' as any };

  it.each(ALLOWED_PAGE_COUNTS)('a %i-page book requires exactly %i accepted pages — one short is rejected', (pageCount) => {
    expect(canGeneratePdf({ acceptedPageCount: pageCount - 1, pageCount, ...eligibleBase })).toBe(false);
  });

  it.each(ALLOWED_PAGE_COUNTS)('a %i-page book permits PDF generation once exactly %i pages are accepted', (pageCount) => {
    expect(canGeneratePdf({ acceptedPageCount: pageCount, pageCount, ...eligibleBase })).toBe(true);
  });

  it.each(ALLOWED_PAGE_COUNTS)('a %i-page book rejects one page over its own length (never trusted, even if it happens to equal another allowed count)', (pageCount) => {
    expect(canGeneratePdf({ acceptedPageCount: pageCount + 1, pageCount, ...eligibleBase })).toBe(false);
  });

  it('also requires content status and pdfStatus to be in an eligible state', () => {
    expect(canGeneratePdf({ acceptedPageCount: 10, pageCount: 10, status: 'FINAL_GENERATING' as any, pdfStatus: 'NONE' as any })).toBe(false);
    expect(canGeneratePdf({ acceptedPageCount: 10, pageCount: 10, status: 'FINAL_READY' as any, pdfStatus: 'GENERATING' as any })).toBe(false);
    expect(canGeneratePdf({ acceptedPageCount: 10, pageCount: 10, status: 'FINAL_READY' as any, pdfStatus: 'CURRENT' as any })).toBe(false);
    expect(canGeneratePdf({ acceptedPageCount: 10, pageCount: 10, status: 'FINAL_READY' as any, pdfStatus: 'STALE' as any })).toBe(true);
    expect(canGeneratePdf({ acceptedPageCount: 10, pageCount: 10, status: 'FINAL_READY' as any, pdfStatus: 'FAILED' as any })).toBe(true);
  });

  it('a 5-page book\'s 5 accepted pages never satisfies a 10-page book\'s requirement (cross-book sanity check)', () => {
    expect(canGeneratePdf({ acceptedPageCount: 5, pageCount: 10, ...eligibleBase })).toBe(false);
  });
});

describe('completion requires a current PDF', () => {
  it('pdfStatus=CURRENT required for completion', () => {
    expect(canComplete({ pdfStatus: 'CURRENT' as any })).toBe(true);
    expect(canComplete({ pdfStatus: 'GENERATING' as any })).toBe(false);
    expect(canComplete({ pdfStatus: 'STALE' as any })).toBe(false);
    expect(canComplete({ pdfStatus: 'NONE' as any })).toBe(false);
    expect(canComplete({ pdfStatus: 'FAILED' as any })).toBe(false);
  });
});

describe('generation idempotency foundation', () => {
  it('a legitimate retry (attempt 2) is representable: same logical key, would-be different event row', () => {
    const base = { bookProjectId: 'book-1', operationType: 'FINAL_PAGE' as any, pageNumber: 7, revisionVersion: 0 };
    const key1 = buildLogicalOperationKey(base);
    const key2 = buildLogicalOperationKey(base);
    expect(key1).toBe(key2);
    expect(key1).toBe('book-1:FINAL_PAGE:7:0');
  });

  it('original generation and its revision are distinguishable logical operations', () => {
    const original = buildLogicalOperationKey({ bookProjectId: 'book-1', operationType: 'FINAL_PAGE', pageNumber: 7, revisionVersion: 0 });
    const revision = buildLogicalOperationKey({ bookProjectId: 'book-1', operationType: 'REVISION', pageNumber: 7, revisionVersion: 1 });
    expect(original).not.toBe(revision);
  });

  it('book-level operations (no page) use a stable "none" placeholder, never null/undefined in the key', () => {
    const key = buildLogicalOperationKey({ bookProjectId: 'book-1', operationType: 'STORY_PLAN', pageNumber: null, revisionVersion: 0 });
    expect(key).toBe('book-1:STORY_PLAN:none:0');
  });
});

describe('page number validation — relative to a specific book\'s own pageCount', () => {
  it.each(ALLOWED_PAGE_COUNTS)('accepts 1 through %i for a %i-page book', (pageCount) => {
    for (let n = 1; n <= pageCount; n++) expect(isValidPageNumber(n, pageCount)).toBe(true);
  });

  it.each(ALLOWED_PAGE_COUNTS)('rejects 0 and pageCount+1 for a %i-page book', (pageCount) => {
    expect(isValidPageNumber(0, pageCount)).toBe(false);
    expect(isValidPageNumber(pageCount + 1, pageCount)).toBe(false);
  });

  it('rejects negatives and non-integers regardless of pageCount', () => {
    expect(isValidPageNumber(-1, 20)).toBe(false);
    expect(isValidPageNumber(5.5, 20)).toBe(false);
  });

  it('page 8 is valid for a 10-page book but invalid for a 5-page book — the pageCount argument is load-bearing', () => {
    expect(isValidPageNumber(8, 10)).toBe(true);
    expect(isValidPageNumber(8, 5)).toBe(false);
  });
});
