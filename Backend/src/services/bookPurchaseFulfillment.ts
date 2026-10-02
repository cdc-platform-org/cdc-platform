import { prisma } from '../lib/prisma';
import { canInitiatePayment } from './bookStateService';
import { calculateAudioPrice, calculateTotalBookPrice } from './bookNarrationService';

// ============================================================
// Children's Book — payment fulfillment. Mirrors
// services/learningPaymentFulfillment.ts's shape (gateway-agnostic
// completion function called from both the BOG webhook dispatch and the
// local dev-payment-simulation route) but needs no $transaction row lock
// of its own: the atomic `updateMany({where:{status:'PAYMENT_PENDING'}})`
// below IS the concurrency guard — a second concurrent call simply updates
// 0 rows and returns handled:false, exactly the "necessary, not
// sufficient" pattern bookStateService's own comments describe.
// ============================================================

export async function completeChildrensBookPurchase(params: { bookProjectId: string }): Promise<{ handled: boolean }> {
  const book = await prisma.bookProject.findUnique({ where: { id: params.bookProjectId } });
  if (!book) return { handled: false };

  const audioPriceGel = calculateAudioPrice(!!book.audioAddOnPurchased);
  const totalPriceGel = calculateTotalBookPrice(book.priceGel, !!book.audioAddOnPurchased);

  const result = await prisma.bookProject.updateMany({
    where: { id: params.bookProjectId, status: 'PAYMENT_PENDING' },
    data: { status: 'PAID', audioPriceGel, totalPriceGel },
  });
  return { handled: result.count === 1 };
}

// Used by the checkout route before creating a BogPayment row — a cheap,
// non-atomic pre-check only (the real guarantee is the updateMany above at
// fulfillment time); this just avoids creating a payment row for a book
// that obviously isn't eligible yet.
export async function assertBookReadyForCheckout(bookProjectId: string, userId: string): Promise<{ id: string; pageCount: number; audioAddOnPurchased: boolean }> {
  const book = await prisma.bookProject.findUnique({ where: { id: bookProjectId } });
  if (!book || book.userId !== userId) throw new BookNotFoundError();
  if (!canInitiatePayment({ status: book.status })) throw new BookNotEligibleForCheckoutError(book.status);
  return { id: book.id, pageCount: book.pageCount, audioAddOnPurchased: !!book.audioAddOnPurchased };
}

export class BookNotFoundError extends Error {
  constructor() {
    super('Book not found.');
    this.name = 'BookNotFoundError';
  }
}

export class BookNotEligibleForCheckoutError extends Error {
  constructor(status: string) {
    super(`Book is not eligible for checkout from status ${status}.`);
    this.name = 'BookNotEligibleForCheckoutError';
  }
}
