-- Children's Book: records when the buyer confirmed the full book preview
-- before paying. Purely additive — one nullable column, no default, no
-- existing row is rewritten. Checkout requires it (see
-- services/bookPurchaseFulfillment.ts assertBookReadyForCheckout).

-- AlterTable
ALTER TABLE "book_projects" ADD COLUMN "previewConfirmedAt" TIMESTAMP(3);
