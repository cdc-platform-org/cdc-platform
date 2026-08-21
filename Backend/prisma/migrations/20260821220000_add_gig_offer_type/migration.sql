-- CreateEnum
CREATE TYPE "GigOfferType" AS ENUM ('CLIENT_REQUEST', 'FREELANCER_OFFER');

-- AlterTable
ALTER TABLE "gigs" ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "offerType" "GigOfferType" NOT NULL DEFAULT 'CLIENT_REQUEST',
ADD COLUMN     "portfolioLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
