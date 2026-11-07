import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { BogPayment, GiftCard, Prisma, PromoCode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sendGiftCardEmail, sendGiftCardDeliveredToBuyerEmail } from './emailService';

// ============================================================
// GIFT CARDS
//
// A buyer pays (BOG) for a card worth N GEL. When the payment completes,
// one PromoCode is minted for it: isGiftCard = true, applicableType ALL,
// discountAmount = the card's balance in tetri, valid for one year. Because
// it is an ordinary promo code, the recipient redeems it in the promo field
// every checkout on the site already has. couponService spends exactly the
// part of the balance a purchase uses; a failed payment gives it back
// (releaseGiftCardHold below).
// ============================================================

export const GIFT_CARD_MIN_GEL = 5;
export const GIFT_CARD_MAX_GEL = 1000;
export const GIFT_CARD_PRESETS_GEL = [10, 20, 50, 100];
export const GIFT_CARD_VALIDITY_DAYS = 365;
export const GIFT_CARD_DESIGNS = ['classic', 'birthday', 'celebration', 'kids'] as const;
export type GiftCardDesign = (typeof GIFT_CARD_DESIGNS)[number];
// Scheduled delivery can be up to a year ahead (e.g. next birthday).
export const GIFT_CARD_MAX_SCHEDULE_DAYS = 366;

// No 0/O/1/I/L — a code people read off a printed card and type by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateGiftCode(): string {
  const block = () => Array.from({ length: 4 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  return `GIFT-${block()}-${block()}`;
}

// Mints the code and moves the card PENDING_PAYMENT -> SCHEDULED. Idempotent:
// a retried callback finds the card already past PENDING_PAYMENT and does
// nothing. Delivery (email) happens right after when deliverAt is due.
export async function fulfillGiftCardPurchase(giftCardId: string): Promise<{ handled: boolean }> {
  const minted = await prisma.$transaction(async (tx) => {
    const claimed = await tx.giftCard.updateMany({ where: { id: giftCardId, status: 'PENDING_PAYMENT' }, data: { status: 'SCHEDULED' } });
    if (claimed.count !== 1) return false;
    const card = await tx.giftCard.findUniqueOrThrow({ where: { id: giftCardId } });
    const expiresAt = new Date(Date.now() + GIFT_CARD_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    let promo: PromoCode | null = null;
    for (let attempt = 0; attempt < 5 && !promo; attempt++) {
      const code = generateGiftCode();
      if (await tx.promoCode.findUnique({ where: { code }, select: { id: true } })) continue;
      promo = await tx.promoCode.create({
        data: { code, discountAmount: card.amount, applicableType: 'ALL', isGiftCard: true, expiresAt, isActive: true },
      });
    }
    if (!promo) throw new Error('Could not generate a unique gift card code.');
    await tx.giftCard.update({ where: { id: card.id }, data: { promoCodeId: promo.id } });
    return true;
  });
  if (!minted) return { handled: false };
  const card = await prisma.giftCard.findUniqueOrThrow({ where: { id: giftCardId } });
  if (card.deliverAt.getTime() <= Date.now()) await deliverGiftCard(card.id);
  return { handled: true };
}

export async function cancelGiftCardPurchase(giftCardId: string): Promise<void> {
  await prisma.giftCard.updateMany({ where: { id: giftCardId, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
}

// SCHEDULED -> DELIVERED is claimed BEFORE sending, so two overlapping
// sweeps (or a sweep racing the callback) can never email twice. A failed
// send is reported to Sentry; the buyer still sees the code in the dashboard
// and can resend it from there.
export async function deliverGiftCard(giftCardId: string): Promise<boolean> {
  const claimed = await prisma.giftCard.updateMany({
    where: { id: giftCardId, status: 'SCHEDULED', promoCodeId: { not: null } },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
  });
  if (claimed.count !== 1) return false;
  const card = await prisma.giftCard.findUniqueOrThrow({
    where: { id: giftCardId },
    include: { promoCode: true, purchaser: { select: { email: true } } },
  });
  try {
    await sendGiftCardEmails(card);
  } catch (err) {
    console.error('[gift-card] delivery email failed:', err);
    Sentry.captureException(err, { extra: { giftCardId } });
  }
  return true;
}

type CardWithRelations = GiftCard & { promoCode: PromoCode | null; purchaser: { email: string } };

async function sendGiftCardEmails(card: CardWithRelations): Promise<void> {
  if (!card.promoCode) return;
  const params = giftCardEmailParams(card, card.promoCode);
  if (card.recipientEmail) {
    await sendGiftCardEmail({ ...params, to: card.recipientEmail });
    await sendGiftCardDeliveredToBuyerEmail({ ...params, to: card.purchaser.email, recipientEmail: card.recipientEmail });
  }
}

function giftCardEmailParams(card: GiftCard, promo: PromoCode) {
  return {
    code: promo.code,
    amountTetri: card.amount,
    senderName: card.senderName,
    recipientName: card.recipientName,
    message: card.message,
    design: (GIFT_CARD_DESIGNS as readonly string[]).includes(card.design) ? (card.design as GiftCardDesign) : 'classic',
    expiresAt: promo.expiresAt,
    suggestedItem: card.suggestedItem,
    suggestedUrl: card.suggestedUrl,
  };
}

// Buyer's "send again" button (recipient lost the email / typo fixed).
export async function resendGiftCardEmail(giftCardId: string, purchaserId: string, newRecipientEmail?: string | null): Promise<GiftCard> {
  const card = await prisma.giftCard.findFirst({ where: { id: giftCardId, purchaserId } });
  if (!card) throw new GiftCardError(404, 'Gift card not found.');
  if (card.status !== 'DELIVERED' && card.status !== 'SCHEDULED') throw new GiftCardError(400, 'This gift card is not paid yet.');
  const updated = newRecipientEmail ? await prisma.giftCard.update({ where: { id: card.id }, data: { recipientEmail: newRecipientEmail } }) : card;
  if (updated.status === 'SCHEDULED') {
    // Not due yet — a new address is simply used on the scheduled day.
    return updated;
  }
  const full = await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id }, include: { promoCode: true, purchaser: { select: { email: true } } } });
  if (!full.recipientEmail) throw new GiftCardError(400, 'Add the recipient\'s email first.');
  await sendGiftCardEmails(full);
  return updated;
}

// Hourly: emails every card whose delivery date has arrived.
export async function sweepScheduledGiftCards(): Promise<{ deliveredIds: string[] }> {
  const due = await prisma.giftCard.findMany({
    where: { status: 'SCHEDULED', deliverAt: { lte: new Date() }, promoCodeId: { not: null } },
    select: { id: true },
    take: 200,
  });
  const deliveredIds: string[] = [];
  for (const { id } of due) {
    if (await deliverGiftCard(id)) deliveredIds.push(id);
  }
  return { deliveredIds };
}

// A checkout that spent part of a gift card balance failed (declined card,
// abandoned and later reported failed by BOG, or a gateway error before the
// order was created): put that part back on the card. Only ever called once
// per payment, right after its own PENDING -> FAILED transition.
export async function releaseGiftCardHold(payment: Pick<BogPayment, 'id' | 'promoCodeId' | 'giftCardAmount'>, client: Prisma.TransactionClient = prisma): Promise<void> {
  if (!payment.promoCodeId || payment.giftCardAmount <= 0) return;
  await client.promoCode.updateMany({
    where: { id: payment.promoCodeId, isGiftCard: true },
    data: { discountAmount: { increment: payment.giftCardAmount }, currentUses: { decrement: 1 } },
  });
}

// Public balance check (by code). Never reveals who bought it.
export async function getGiftCardBalance(rawCode: string) {
  const promo = await prisma.promoCode.findUnique({
    where: { code: rawCode.trim().toUpperCase() },
    include: { giftCard: { select: { amount: true, recipientName: true, senderName: true, message: true, design: true, suggestedItem: true, suggestedUrl: true, status: true } } },
  });
  if (!promo || !promo.isGiftCard || !promo.giftCard) return null;
  return {
    code: promo.code,
    initialAmount: promo.giftCard.amount,
    balance: Math.max(0, promo.discountAmount ?? 0),
    expiresAt: promo.expiresAt,
    isActive: promo.isActive && (!promo.expiresAt || promo.expiresAt > new Date()),
    recipientName: promo.giftCard.recipientName,
    senderName: promo.giftCard.senderName,
    message: promo.giftCard.message,
    design: promo.giftCard.design,
    suggestedItem: promo.giftCard.suggestedItem,
    suggestedUrl: promo.giftCard.suggestedUrl,
  };
}

export class GiftCardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GiftCardError';
  }
}

export function publicGiftCard(card: GiftCard & { promoCode?: PromoCode | null }) {
  const promo = card.promoCode ?? null;
  return {
    id: card.id,
    amount: card.amount,
    status: card.status,
    senderName: card.senderName,
    recipientName: card.recipientName,
    recipientEmail: card.recipientEmail,
    message: card.message,
    design: card.design,
    deliverAt: card.deliverAt,
    deliveredAt: card.deliveredAt,
    suggestedItem: card.suggestedItem,
    suggestedUrl: card.suggestedUrl,
    createdAt: card.createdAt,
    code: promo?.code ?? null,
    balance: promo ? Math.max(0, promo.discountAmount ?? 0) : null,
    expiresAt: promo?.expiresAt ?? null,
    isActive: promo ? promo.isActive : null,
  };
}
