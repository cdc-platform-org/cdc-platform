-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'MENTORSHIP_SESSION_CREDIT';

-- AlterTable
ALTER TABLE "mentorship_bookings" ADD COLUMN     "commissionAmount" INTEGER,
ADD COLUMN     "commissionRate" DOUBLE PRECISION,
ADD COLUMN     "netAmount" INTEGER;

-- AlterTable
ALTER TABLE "wallet_entries" ADD COLUMN     "relatedMentorshipBookingId" TEXT;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_relatedMentorshipBookingId_fkey" FOREIGN KEY ("relatedMentorshipBookingId") REFERENCES "mentorship_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
