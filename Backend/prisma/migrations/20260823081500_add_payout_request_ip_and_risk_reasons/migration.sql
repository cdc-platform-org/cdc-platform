-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN     "requestIp" TEXT,
ADD COLUMN     "riskReasons" TEXT[] DEFAULT ARRAY[]::TEXT[];
