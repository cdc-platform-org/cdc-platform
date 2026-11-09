import { prisma } from '../lib/prisma';
import { buildBookPdf, BookPdfPageInput } from './bookPdfService';
import { storeBookAsset, readBookAsset } from './bookStorageService';
import { canComplete, canGeneratePdf } from './bookStateService';
import { canGenerateNarration, narrationLanguageForBook } from './bookNarrationService';
import { getBookNarrationProvider } from './bookNarrationProviders';
import { ensureBookExtras, markPdfLayout, pdfExtrasForBook } from './bookExtrasService';

// ============================================================
// Children's Book — finishing a book once every page is drawn: the stored
// A4 PDF and (when the audio add-on was bought) the narration of every page.
// Both used to wait for the parent to press a button, so a paid book could
// sit at "ready" with the PDF download greyed out in the list and no audio
// at all. They now run automatically right after the last page is accepted
// (bookFinalGenerationService) and again from the periodic recovery sweep,
// so a transient failure (storage, speech service) heals on its own. The
// buttons on the book page stay as a manual fallback.
// ============================================================

type PdfSourcePage = { pageNumber: number; storyText: string | null; sceneSpec: unknown };

export async function collectPdfPages(pages: PdfSourcePage[]): Promise<BookPdfPageInput[]> {
  const pdfPages: BookPdfPageInput[] = [];
  for (const page of pages) {
    const imageKey = (page.sceneSpec as any)?.imageKey as string | undefined;
    const imageMimeType = (page.sceneSpec as any)?.imageMimeType as string | undefined;
    let imageBuffer: Buffer | null = null;
    if (imageKey) {
      try {
        imageBuffer = await readBookAsset(imageKey);
      } catch {
        imageBuffer = null;
      }
    }
    pdfPages.push({ pageNumber: page.pageNumber, storyText: page.storyText ?? '', imageBuffer, imageMimeType: imageMimeType ?? null });
  }
  return pdfPages;
}

export type PdfBuildOutcome = 'BUILT' | 'NOT_ELIGIBLE' | 'IN_PROGRESS' | 'FAILED';

// Builds and stores the A4 PDF, moving FINAL_READY -> COMPLETED. Shared by
// POST /:id/pdf and the automatic finishing step.
export async function buildAndStoreBookPdf(bookId: string): Promise<PdfBuildOutcome> {
  const book = await prisma.bookProject.findUnique({ where: { id: bookId }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!book) return 'NOT_ELIGIBLE';
  const acceptedPageCount = book.pages.filter((p) => p.acceptedEventId).length;
  if (!canGeneratePdf({ acceptedPageCount, pageCount: book.pageCount, status: book.status, pdfStatus: book.pdfStatus })) {
    return book.pdfStatus === 'GENERATING' ? 'IN_PROGRESS' : 'NOT_ELIGIBLE';
  }

  const claim = await prisma.bookProject.updateMany({
    where: { id: book.id, pdfStatus: { in: ['NONE', 'STALE', 'FAILED'] } },
    data: { pdfStatus: 'GENERATING' },
  });
  if (claim.count !== 1) return 'IN_PROGRESS';

  try {
    const pdfPages = await collectPdfPages(book.pages);
    const pdfBuffer = await buildBookPdf({
      title: book.title,
      dedication: (book.characterConfig as any)?.dedication ?? null,
      pageCount: book.pageCount,
      pages: pdfPages,
      fontId: (book.characterConfig as any)?.fontId ?? null,
      ...(await pdfExtrasForBook(book)),
    });
    const newVersion = book.pdfVersion + 1;
    const pdfKey = `books/${book.id}/final-v${newVersion}.pdf`;
    await storeBookAsset(pdfKey, pdfBuffer, 'application/pdf');

    const updated = await prisma.bookProject.update({
      where: { id: book.id },
      data: { pdfStatus: 'CURRENT', pdfVersion: newVersion, finalPdfBlobRef: pdfKey },
    });
    await markPdfLayout(book.id).catch(() => {});
    if (canComplete({ pdfStatus: updated.pdfStatus })) {
      await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_READY' }, data: { status: 'COMPLETED' } });
    }
    return 'BUILT';
  } catch (err) {
    await prisma.bookProject.update({ where: { id: book.id }, data: { pdfStatus: 'FAILED' } }).catch(() => {});
    console.error(`[childrens-book] PDF generation failed for ${bookId}:`, err);
    return 'FAILED';
  }
}

// Narrates every page that has no READY narration yet (never re-bills a
// finished page). Returns how many pages are still missing afterwards.
export async function narrateMissingPages(bookId: string): Promise<{ narrated: number; missing: number; error?: unknown }> {
  const book = await prisma.bookProject.findUnique({ where: { id: bookId }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!book || !canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status })) {
    return { narrated: 0, missing: 0 };
  }
  const ready = await prisma.bookNarrationArtifact.findMany({ where: { bookProjectId: book.id, status: 'READY', artifactKey: { not: null } }, select: { pageNumber: true } });
  const readyPages = new Set(ready.map((a) => a.pageNumber));
  const todo = book.pages.filter((p) => !readyPages.has(p.pageNumber));
  const provider = getBookNarrationProvider();
  let narrated = 0;
  for (const page of todo) {
    try {
      const result = await provider.generatePageNarration({
        bookProjectId: book.id,
        pageNumber: page.pageNumber,
        revisionVersion: 0,
        language: narrationLanguageForBook(book.language),
        text: page.storyText ?? '',
      });
      await storeBookAsset(result.storageKey, result.buffer, result.mimeType);
      await prisma.bookNarrationArtifact.upsert({
        where: { bookProjectId_pageNumber_revisionVersion: { bookProjectId: book.id, pageNumber: page.pageNumber, revisionVersion: 0 } },
        update: { status: 'READY', language: result.language, mimeType: result.mimeType, artifactKey: result.storageKey, attemptCount: { increment: 1 } },
        create: {
          bookProjectId: book.id,
          pageNumber: page.pageNumber,
          revisionVersion: 0,
          status: 'READY',
          language: result.language,
          mimeType: result.mimeType,
          artifactKey: result.storageKey,
          attemptCount: 1,
        },
      });
      narrated += 1;
    } catch (err) {
      console.warn(`[childrens-book] narration of page ${page.pageNumber} of ${book.id} failed:`, err instanceof Error ? err.message : err);
      return { narrated, missing: todo.length - narrated, error: err };
    }
  }
  return { narrated, missing: 0 };
}

// Book extras (introduction, share link, and for a freshly drawn book its
// cover picture) first, then the PDF (the parent is waiting for the
// download), then audio. Each step logs and swallows its own failure so one
// never blocks the next.
export async function finishBook(bookId: string, opts: { drawCoverImage?: boolean } = {}): Promise<void> {
  try {
    await ensureBookExtras(bookId, opts);
  } catch (err) {
    console.error(`[childrens-book] finishing extras crashed for ${bookId}:`, err);
  }
  try {
    await buildAndStoreBookPdf(bookId);
  } catch (err) {
    console.error(`[childrens-book] finishing PDF crashed for ${bookId}:`, err);
  }
  try {
    await narrateMissingPages(bookId);
  } catch (err) {
    console.error(`[childrens-book] finishing narration crashed for ${bookId}:`, err);
  }
}
