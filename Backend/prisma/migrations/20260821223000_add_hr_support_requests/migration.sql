-- AlterEnum
ALTER TYPE "BogPaymentPurpose" ADD VALUE 'HR_SUPPORT';

-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'HR_SUPPORT_CREDIT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isHrSpecialist" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "wallet_entries" ADD COLUMN     "relatedHRSupportRequestId" TEXT;

-- CreateTable
CREATE TABLE "hr_support_requests" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "assignedSpecialistId" TEXT,
    "candidateCount" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GEL',
    "tosAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "commissionRate" DOUBLE PRECISION,
    "commissionAmount" INTEGER,
    "netAmount" INTEGER,
    "escrowStatus" TEXT,
    "paidAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "reportSummary" TEXT,
    "autoReleaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseTrigger" TEXT,
    "disputeRaisedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeResolvedAt" TIMESTAMP(3),
    "disputeResolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_candidate_evaluations" (
    "id" TEXT NOT NULL,
    "hrRequestId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "hardSkillsScore" INTEGER,
    "softSkillsScore" INTEGER,
    "taskScore" INTEGER,
    "culturalFitScore" INTEGER,
    "overallRank" INTEGER,
    "hrNotes" TEXT,
    "meetingUrl" TEXT,
    "interviewAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_candidate_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_support_requests_status_idx" ON "hr_support_requests"("status");

-- CreateIndex
CREATE INDEX "hr_support_requests_requestedById_idx" ON "hr_support_requests"("requestedById");

-- CreateIndex
CREATE INDEX "hr_support_requests_assignedSpecialistId_idx" ON "hr_support_requests"("assignedSpecialistId");

-- CreateIndex
CREATE UNIQUE INDEX "hr_candidate_evaluations_applicationId_key" ON "hr_candidate_evaluations"("applicationId");

-- CreateIndex
CREATE INDEX "hr_candidate_evaluations_hrRequestId_idx" ON "hr_candidate_evaluations"("hrRequestId");

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_relatedHRSupportRequestId_fkey" FOREIGN KEY ("relatedHRSupportRequestId") REFERENCES "hr_support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_support_requests" ADD CONSTRAINT "hr_support_requests_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_support_requests" ADD CONSTRAINT "hr_support_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_support_requests" ADD CONSTRAINT "hr_support_requests_assignedSpecialistId_fkey" FOREIGN KEY ("assignedSpecialistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_candidate_evaluations" ADD CONSTRAINT "hr_candidate_evaluations_hrRequestId_fkey" FOREIGN KEY ("hrRequestId") REFERENCES "hr_support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_candidate_evaluations" ADD CONSTRAINT "hr_candidate_evaluations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "vacancy_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
