import { prisma } from '../lib/prisma';
import { buildLogicalOperationKey, canStartFinalGeneration } from './bookStateService';
import { StoryPlan } from './bookStoryPlanService';
import { generateBookImage } from './bookImageGenerationService';
import { runImageQa, isAcceptableQaStatus } from './bookQaService';
import { storeBookAsset } from './bookStorageService';
import { appearancePromptLine, extraCharactersPromptLine, loadReferenceImage } from './bookCharacterDetailsService';

// ============================================================
// Children's Book — final generation runner. Runs in the background, never
// inside an HTTP request: real image generation takes tens of seconds per
// page, so a 5-20 page book easily exceeds App Service's ~230 s request
// timeout. Callers (the BOG webhook, the start route, the startup resume
// sweep) only claim the book and kick this off; the frontend polls
// /final-generation/status while the book is FINAL_GENERATING.
//
// Started automatically once payment completes, so a paid book never waits
// for the user to press a button. Per-page retry: only pages without an
// accepted artifact are (re)generated, each up to PAGE_ATTEMPTS_PER_RUN
// times per run. A run that still ends with missing pages moves the book to
// FAILED, from which the user's Retry (or the next resume sweep) restarts
// it - canStartFinalGeneration accepts FAILED once a Character Bible exists.
// ============================================================

const PAGE_ATTEMPTS_PER_RUN = 2;

// One run per book per process. The status claim below is the cross-process
// guard; this map just stops a duplicate webhook or a double click from
// starting a second loop over the same pages in this instance.
const inFlight = new Map<string, Promise<void>>();

export type StartFinalGenerationResult = 'STARTED' | 'ALREADY_RUNNING' | 'NOT_ELIGIBLE' | 'NOT_FOUND';

export async function startFinalGeneration(bookProjectId: string): Promise<StartFinalGenerationResult> {
  if (inFlight.has(bookProjectId)) return 'ALREADY_RUNNING';

  const book = await prisma.bookProject.findUnique({ where: { id: bookProjectId } });
  if (!book) return 'NOT_FOUND';
  if (!canStartFinalGeneration({ status: book.status, characterBible: book.characterBible, styleBible: book.styleBible, storyPlan: book.storyPlan })) {
    return 'NOT_ELIGIBLE';
  }

  if (book.status === 'PAID' || book.status === 'FAILED') {
    const claim = await prisma.bookProject.updateMany({ where: { id: book.id, status: book.status }, data: { status: 'FINAL_GENERATING' } });
    if (claim.count !== 1) return 'ALREADY_RUNNING';
  }
  if (inFlight.has(bookProjectId)) return 'ALREADY_RUNNING';

  const run = runFinalGeneration(bookProjectId)
    .catch(async (err) => {
      console.error(`[childrens-book] final generation crashed for ${bookProjectId}:`, err);
      await prisma.bookProject
        .updateMany({ where: { id: bookProjectId, status: { in: ['FINAL_GENERATING', 'FINAL_QA'] } }, data: { status: 'FAILED' } })
        .catch(() => {});
    })
    .finally(() => inFlight.delete(bookProjectId));
  inFlight.set(bookProjectId, run);
  return 'STARTED';
}

// Test/ops hook: resolves once the in-process run for this book (if any) ends.
export async function waitForFinalGeneration(bookProjectId: string): Promise<void> {
  await inFlight.get(bookProjectId);
}

// Called once at server start. Picks up paid books whose run never started
// (PAID) or was cut off by a restart/deploy mid-run (FINAL_GENERATING).
export async function resumePendingFinalGenerations(): Promise<number> {
  const books = await prisma.bookProject.findMany({ where: { status: { in: ['PAID', 'FINAL_GENERATING'] } }, select: { id: true } });
  let started = 0;
  for (const { id } of books) {
    if ((await startFinalGeneration(id)) === 'STARTED') started += 1;
  }
  if (books.length) console.log(`[childrens-book] resume sweep: ${started}/${books.length} paid book(s) restarted`);
  return started;
}

async function runFinalGeneration(bookProjectId: string): Promise<void> {
  const book = await prisma.bookProject.findUnique({ where: { id: bookProjectId }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!book) return;

  const storyPlan = book.storyPlan as unknown as StoryPlan;
  const characterBible = book.characterBible as any;
  const styleBible = book.styleBible as any;
  // Loaded once per run: the approved portrait, used as a reference image
  // only for books where the parent supplied a photo.
  const referenceImages = characterBible?.useReferencePortrait
    ? await loadReferenceImage(characterBible.previewImageKey, characterBible.previewImageMimeType)
    : [];

  for (const page of book.pages) {
    if (page.acceptedEventId) continue; // already accepted — per-page retry only touches unfinished pages

    const planPage = storyPlan.pages.find((p) => p.pageNumber === page.pageNumber);
    const prompt = [
      `Children's storybook illustration, ${styleBible?.illustrationStyle ?? 'STORYBOOK_WATERCOLOR'} style.`,
      `Character: ${characterBible?.name ?? ''}, consistent with the approved Character Bible.`,
      appearancePromptLine(characterBible),
      extraCharactersPromptLine(characterBible),
      planPage ? `Scene: ${planPage.sceneDescription}. Composition: ${planPage.composition}.` : '',
      'No readable text or letters anywhere in the image. Reserve the upper-left 30% free of detail.',
    ].filter(Boolean).join(' ');

    for (let attempt = 0; attempt < PAGE_ATTEMPTS_PER_RUN; attempt += 1) {
      const previousAttempts = await prisma.bookGenerationEvent.count({
        where: { bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 },
      });
      const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 });

      await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'GENERATING', attemptCount: { increment: 1 } } });

      const started = new Date();
      const result = await generateBookImage({ prompt, size: '1024x1024', quality: book.finalQuality === 'high' ? 'high' : 'medium', referenceImages });
      const completed = new Date();
      const qa = runImageQa({ imageSuccess: result.success, byteSize: result.success ? result.byteSize : 0 });

      const event = await prisma.bookGenerationEvent.create({
        data: {
          bookProjectId: book.id,
          pageNumber: page.pageNumber,
          operationType: 'FINAL_PAGE',
          logicalOperationKey,
          attemptNumber: previousAttempts + 1,
          revisionVersion: 0,
          deployment: result.deployment,
          quality: 'medium',
          requestedSize: '1024x1024',
          requestId: result.requestId,
          latencyMs: result.latencyMs,
          success: result.success && isAcceptableQaStatus(qa.status),
          errorClassification: result.success ? (isAcceptableQaStatus(qa.status) ? null : 'REQUEST_SCHEMA') : result.errorClassification,
          startedAt: started,
          completedAt: completed,
        },
      });

      if (result.success && isAcceptableQaStatus(qa.status)) {
        const key = `books/${book.id}/events/${event.id}.png`;
        await storeBookAsset(key, result.buffer, result.mimeType);
        await prisma.bookPage.update({
          where: { id: page.id },
          data: { imageGenerationStatus: 'READY', qaStatus: qa.status, acceptedEventId: event.id, sceneSpec: { ...(page.sceneSpec as any), imageKey: key, imageMimeType: result.mimeType } as any },
        });
        break;
      }
      console.warn(`[childrens-book] page ${page.pageNumber} of ${book.id} failed (attempt ${attempt + 1}): ${result.success ? 'QA' : result.errorClassification}`);
      await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'FAILED', qaStatus: 'FAIL' } });
    }
  }

  const acceptedCount = await prisma.bookPage.count({ where: { bookProjectId: book.id, acceptedEventId: { not: null } } });
  if (acceptedCount === book.pageCount) {
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_GENERATING' }, data: { status: 'FINAL_QA' } });
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_QA' }, data: { status: 'FINAL_READY' } });
  } else {
    await prisma.bookProject.updateMany({ where: { id: book.id, status: { in: ['FINAL_GENERATING', 'FINAL_QA'] } }, data: { status: 'FAILED' } });
  }
}
