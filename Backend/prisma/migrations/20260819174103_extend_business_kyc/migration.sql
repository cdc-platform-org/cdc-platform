-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessKycCheckedAt" TIMESTAMP(3),
ADD COLUMN     "businessKycExtractedData" JSONB,
ADD COLUMN     "businessKycReasoning" TEXT,
ADD COLUMN     "businessKycRejectionReason" TEXT,
ADD COLUMN     "businessKycScore" INTEGER;
