-- AlterTable
ALTER TABLE "billing_settings" ADD COLUMN     "bankTransferAccountName" TEXT,
ADD COLUMN     "bankTransferBankName" TEXT,
ADD COLUMN     "bankTransferIban" TEXT;

-- AlterTable
ALTER TABLE "billing_subscriptions" ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "trialWarningSentAt" TIMESTAMP(3);
