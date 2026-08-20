-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'STRIPE';

-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN     "howItWorksSteps" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCustomerId" TEXT;
