-- Children's Book — variable page count / 1-GEL-per-page product model.
-- Replaces the earlier fixed "10 pages for 15 GEL" model
-- (20261001130000_childrens_book_foundation's original CHECK constraints).

-- Drop the old fixed-value constraints FIRST — the data-fix UPDATE below
-- writes priceGel=pageCount*100 (e.g. 1000 for a 10-page book), which the
-- OLD "priceGel = 1500" constraint would itself reject if it were still
-- active during the UPDATE.
ALTER TABLE "book_projects" DROP CONSTRAINT "book_projects_pageCount_check";
ALTER TABLE "book_projects" DROP CONSTRAINT "book_projects_priceGel_check";
ALTER TABLE "book_pages" DROP CONSTRAINT "book_pages_pageNumber_check";

-- Existing local/QA BookProject rows predate this model and were all
-- created with pageCount=10, priceGel=1500 (flat 15 GEL regardless of page
-- count) — under the new 1-GEL-per-page rule a 10-page book is 1000 tetri,
-- not 1500. This UPDATE is scoped to exactly the one field that changed
-- meaning (priceGel), only touches rows where it's already wrong — a
-- genuinely disposable local/QA correction, never applied to a BogPayment
-- row (those remain an untouched historical record of what was actually
-- sent to BOG at checkout time).
UPDATE "book_projects" SET "priceGel" = "pageCount" * 100 WHERE "priceGel" != "pageCount" * 100;

-- Add the new, widened constraints. priceGel's new CHECK is now a
-- two-column relationship (priceGel = pageCount * 100) rather than a fixed
-- constant — Postgres CHECK constraints may reference other columns of the
-- same row, so this is still expressible without a trigger. pageNumber's
-- global bound widens from 1..10 to 1..20 (MAX_PAGE_COUNT); a given book's
-- own valid range (1..BookProject.pageCount) is enforced at the
-- application layer only — see bookStateService.isValidPageNumber.
ALTER TABLE "book_projects" ADD CONSTRAINT "book_projects_pageCount_check" CHECK ("pageCount" IN (5, 10, 15, 20));
ALTER TABLE "book_projects" ADD CONSTRAINT "book_projects_priceGel_check" CHECK ("priceGel" = "pageCount" * 100);
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_pageNumber_check" CHECK ("pageNumber" BETWEEN 1 AND 20);
