import { resolveBookPayableAmountTetri } from '../bookMockConfig';

// Pure-function test suite for the Children's Book QA payment discount —
// no DB, no network, no real BOG call. See bookMockConfig.ts's own comment
// for why this exists: a real BOG order must never be overcharged/undercharged
// by surprise, and must never apply outside the one named book in non-production.

const LIST_PRICE = 1500; // 15 GEL

describe('resolveBookPayableAmountTetri', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the list price when no QA discount book id is configured', () => {
    delete process.env.BOOK_QA_DISCOUNT_BOOK_ID;
    delete process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI;
    expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(LIST_PRICE);
  });

  it('returns the list price for a book id that does not match the configured one', () => {
    process.env.BOOK_QA_DISCOUNT_BOOK_ID = 'book-1';
    process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = '100';
    expect(resolveBookPayableAmountTetri('book-2', LIST_PRICE)).toBe(LIST_PRICE);
  });

  it('returns the discounted amount for an exact match with a valid discount', () => {
    process.env.BOOK_QA_DISCOUNT_BOOK_ID = 'book-1';
    process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = '100';
    expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(100);
  });

  it('fails closed to the list price when the discount amount is >= list price (never an upcharge)', () => {
    process.env.BOOK_QA_DISCOUNT_BOOK_ID = 'book-1';
    process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = '1500';
    expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(LIST_PRICE);
    process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = '2000';
    expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(LIST_PRICE);
  });

  it('fails closed to the list price for a zero, negative, or non-integer discount amount', () => {
    process.env.BOOK_QA_DISCOUNT_BOOK_ID = 'book-1';
    for (const bad of ['0', '-50', '12.5']) {
      process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = bad;
      expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(LIST_PRICE);
    }
  });

  it('is hard-disabled in production regardless of env vars', () => {
    process.env.NODE_ENV = 'production';
    process.env.BOOK_QA_DISCOUNT_BOOK_ID = 'book-1';
    process.env.BOOK_QA_DISCOUNT_AMOUNT_TETRI = '100';
    expect(resolveBookPayableAmountTetri('book-1', LIST_PRICE)).toBe(LIST_PRICE);
  });
});
