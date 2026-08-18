-- AlterTable
ALTER TABLE "mentorship_bookings" ADD COLUMN     "stripePaymentId" TEXT,
ALTER COLUMN "bogPaymentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "stripe_payments" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "userId" TEXT NOT NULL,
    "purpose" "BogPaymentPurpose" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "BogPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "rawEvent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "promoCodeId" TEXT,

    CONSTRAINT "stripe_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_payments_stripeSessionId_key" ON "stripe_payments"("stripeSessionId");

-- CreateIndex
CREATE INDEX "stripe_payments_userId_idx" ON "stripe_payments"("userId");

-- CreateIndex
CREATE INDEX "stripe_payments_purpose_referenceId_idx" ON "stripe_payments"("purpose", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_bookings_stripePaymentId_key" ON "mentorship_bookings"("stripePaymentId");

-- AddForeignKey
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_bookings" ADD CONSTRAINT "mentorship_bookings_stripePaymentId_fkey" FOREIGN KEY ("stripePaymentId") REFERENCES "stripe_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

