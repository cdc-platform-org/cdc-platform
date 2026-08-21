-- AlterTable
ALTER TABLE "mentorship_bookings" ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "disputeRaisedAt" TIMESTAMP(3),
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputeResolution" TEXT,
ADD COLUMN     "disputeResolvedAt" TIMESTAMP(3),
ADD COLUMN     "escrowStatus" TEXT,
ADD COLUMN     "releaseTrigger" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3);
