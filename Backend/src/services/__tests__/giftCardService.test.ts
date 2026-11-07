import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { createUser, createCourse } from '../../test/factories';

const mockSendGiftCardEmail = jest.fn();
const mockSendBuyerEmail = jest.fn();
jest.mock('../emailService', () => ({
  ...jest.requireActual('../emailService'),
  sendGiftCardEmail: (...args: unknown[]) => mockSendGiftCardEmail(...args),
  sendGiftCardDeliveredToBuyerEmail: (...args: unknown[]) => mockSendBuyerEmail(...args),
}));

import { fulfillGiftCardPurchase, sweepScheduledGiftCards, getGiftCardBalance, generateGiftCode } from '../giftCardService';
import { computePromoPrice, quotePromoToCheckout, claimPromoRedemption, giftCardAmountOf, findValidPromoCode, PromoCodeError } from '../couponService';
import { applyBogPaymentResult } from '../../routes/payments';
import { buildGiftCardEmailHtml } from '../emailService';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  mockSendGiftCardEmail.mockReset();
  mockSendBuyerEmail.mockReset();
});

async function createPaidGiftCard(opts: { amount?: number; deliverAt?: Date; recipientEmail?: string | null } = {}) {
  const buyer = await createUser();
  const card = await prisma.giftCard.create({
    data: {
      purchaserId: buyer.id,
      amount: opts.amount ?? 5000,
      senderName: 'ნინო',
      recipientName: 'გიორგი',
      recipientEmail: opts.recipientEmail === undefined ? `r-${randomUUID()}@example.com` : opts.recipientEmail,
      message: 'გილოცავ! <b>xss</b>',
      deliverAt: opts.deliverAt ?? new Date(),
    },
  });
  return { buyer, card };
}

describe('gift cards', () => {
  it('generates readable GIFT-XXXX-XXXX codes', () => {
    for (let i = 0; i < 50; i++) expect(generateGiftCode()).toMatch(/^GIFT-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it('a gift card pays down the current (sale) price, never below zero', () => {
    const gift = { discountPercent: null, discountAmount: 2000, isGiftCard: true };
    expect(computePromoPrice(7000, 10000, gift)).toBe(5000);
    expect(computePromoPrice(1500, 1500, gift)).toBe(0);
  });

  it('fulfilment mints one ALL-products code with a 1-year expiry and emails the recipient; retries are no-ops', async () => {
    const { card } = await createPaidGiftCard();
    expect((await fulfillGiftCardPurchase(card.id)).handled).toBe(true);
    expect((await fulfillGiftCardPurchase(card.id)).handled).toBe(false);

    const fresh = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id }, include: { promoCode: true } });
    expect(fresh.status).toBe('DELIVERED');
    expect(fresh.promoCode).toMatchObject({ isGiftCard: true, applicableType: 'ALL', discountAmount: 5000, isActive: true });
    const days = (fresh.promoCode!.expiresAt!.getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(364);
    expect(mockSendGiftCardEmail).toHaveBeenCalledTimes(1);
    expect(mockSendGiftCardEmail.mock.calls[0][0]).toMatchObject({ code: fresh.promoCode!.code, amountTetri: 5000 });
    expect(mockSendBuyerEmail).toHaveBeenCalledTimes(1);
  });

  it('a card scheduled for later is only emailed once its date arrives', async () => {
    const { card } = await createPaidGiftCard({ deliverAt: new Date(Date.now() + 3 * 86400000) });
    await fulfillGiftCardPurchase(card.id);
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } })).status).toBe('SCHEDULED');
    expect(mockSendGiftCardEmail).not.toHaveBeenCalled();

    expect((await sweepScheduledGiftCards()).deliveredIds).not.toContain(card.id);
    await prisma.giftCard.update({ where: { id: card.id }, data: { deliverAt: new Date(Date.now() - 1000) } });
    expect((await sweepScheduledGiftCards()).deliveredIds).toContain(card.id);
    expect((await sweepScheduledGiftCards()).deliveredIds).not.toContain(card.id);
    expect(mockSendGiftCardEmail).toHaveBeenCalledTimes(1);
  });

  it('spends only what a purchase used, keeps the rest, and gives it back when the payment fails', async () => {
    const { card } = await createPaidGiftCard({ amount: 5000 });
    await fulfillGiftCardPurchase(card.id);
    const code = (await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id }, include: { promoCode: true } })).promoCode!.code;
    const buyer = await createUser();
    const course = await createCourse({ originalPrice: 3000 });

    // 30 GEL course, 50 GEL card: free, 20 GEL left.
    const q1 = await quotePromoToCheckout(code, 'COURSE', course.id, 3000);
    expect(q1.chargeAmount).toBe(0);
    expect(giftCardAmountOf(q1.appliedPromo)).toBe(3000);
    await claimPromoRedemption(q1.appliedPromo!);
    expect((await getGiftCardBalance(code))!.balance).toBe(2000);

    // Next: 30 GEL again, card covers 20, 10 charged; payment then fails.
    const q2 = await quotePromoToCheckout(code, 'COURSE', course.id, 3000);
    expect(q2.chargeAmount).toBe(1000);
    await claimPromoRedemption(q2.appliedPromo!);
    expect((await getGiftCardBalance(code))!.balance).toBe(0);
    await expect(findValidPromoCode(code, 'COURSE', course.id)).rejects.toThrow(PromoCodeError);

    // Re-claiming with a stale quote must not double-spend.
    await expect(claimPromoRedemption(q2.appliedPromo!)).rejects.toThrow(PromoCodeError);

    const payment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `real-${randomUUID()}`, userId: buyer.id, purpose: 'COURSE', paymentModel: 'DIRECT', referenceId: course.id,
        amount: 1000, currency: 'GEL', status: 'PENDING', promoCodeId: q2.appliedPromo!.id, giftCardAmount: giftCardAmountOf(q2.appliedPromo),
      },
    });
    await applyBogPaymentResult(payment.id, 'rejected', {});
    await applyBogPaymentResult(payment.id, 'rejected', {});
    expect((await getGiftCardBalance(code))!.balance).toBe(2000);
  });

  it('a failed gift card purchase is cancelled and never mints a code', async () => {
    const buyer = await createUser();
    const card = await prisma.giftCard.create({
      data: { purchaserId: buyer.id, amount: 2000, senderName: 'A', recipientName: 'B', deliverAt: new Date() },
    });
    const payment = await prisma.bogPayment.create({
      data: { bogOrderId: `real-${randomUUID()}`, userId: buyer.id, purpose: 'GIFT_CARD', paymentModel: 'DIRECT', referenceId: card.id, amount: 2000, currency: 'GEL', status: 'PENDING' },
    });
    await applyBogPaymentResult(payment.id, 'rejected', {});
    const fresh = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } });
    expect(fresh.status).toBe('CANCELLED');
    expect(fresh.promoCodeId).toBeNull();
  });

  it('a completed gift card payment mints and delivers the card via the BOG callback path', async () => {
    const { buyer, card } = await createPaidGiftCard({ recipientEmail: null });
    const payment = await prisma.bogPayment.create({
      data: { bogOrderId: `real-${randomUUID()}`, userId: buyer.id, purpose: 'GIFT_CARD', paymentModel: 'DIRECT', referenceId: card.id, amount: 5000, currency: 'GEL', status: 'PENDING' },
    });
    await applyBogPaymentResult(payment.id, 'completed', {});
    const fresh = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } });
    expect(fresh.status).toBe('DELIVERED');
    expect(fresh.promoCodeId).not.toBeNull();
    // No recipient email (buyer prints it) → nothing sent.
    expect(mockSendGiftCardEmail).not.toHaveBeenCalled();
  });

  it('escapes user text in the gift email', () => {
    const html = buildGiftCardEmailHtml({
      to: 'x@example.com', code: 'GIFT-AAAA-BBBB', amountTetri: 5000, senderName: '<script>', recipientName: 'B', message: '<img src=x>', design: 'birthday',
      expiresAt: new Date(), suggestedItem: null, suggestedUrl: 'https://evil.example',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('50 <span');
  });
});
