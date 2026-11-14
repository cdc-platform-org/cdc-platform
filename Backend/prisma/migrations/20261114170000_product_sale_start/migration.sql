-- Optional start moment for a DigitalProduct sale (admin-scheduled discounts).
-- Null keeps today's behaviour: the sale is live as soon as discountedPrice is set.
ALTER TABLE "digital_products" ADD COLUMN "saleStartsAt" TIMESTAMP(3);
