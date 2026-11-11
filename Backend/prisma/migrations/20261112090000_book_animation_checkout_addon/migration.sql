-- Animated video add-on chosen at book checkout (paid with the book).
-- Additive only: new column with a default, no data change.
ALTER TABLE "book_projects" ADD COLUMN "animationAddOnPurchased" BOOLEAN NOT NULL DEFAULT false;
