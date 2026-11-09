import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ensureBookCast, castPromptLine, BookCast } from './bookCastService';
import { finishBook } from './bookFinishingService';
import { readExtras, BOOK_PDF_LAYOUT_VERSION } from './bookExtrasService';
import { buildLogicalOperationKey, canStartFinalGeneration } from './bookStateService';
import { StoryPlan } from './bookStoryPlanService';
import { generateBookImage } from './bookImageGenerationService';
import { runImageQa, isAcceptableQaStatus } from './bookQaService';
import { storeBookAsset } from './bookStorageService';
import { illustrationStylePromptLine } from './bookIllustrationStyles';
import { appearancePromptLine, extraCharactersPromptLine, siblingsPromptLine, loadCharacterReference, consistencyPromptLine, pageStoryPromptLines } from './bookCharacterDetailsService';

// ============================================================
// Children's Book — final generation runner. Runs in the background, never
// inside an HTTP request: real image generation takes tens of seconds per
// page, so a 5-20 page book easily exceeds App Service's ~230 s request
// timeout. Callers (the BOG webhook, the start route, the startup resume
// sweep) only claim the book and kick this off; the frontend polls
// /final-generation/status while the book is FINAL_GENERATING.
//
// Started automatically once payment completes, so a paid book never waits
// for the user to press a button. Recovery is automatic too (a client must
// never be asked to press "retry" for a book they paid for):
//   - every page gets PAGE_ATTEMPTS_PER_ROUND tries with a back-off between
//     them (longer after a rate limit, which is what failed real books when
//     two back-to-back attempts both hit Azure's per-minute image quota);
//   - pages still missing after a pass get up to AUTO_ROUNDS more passes in
//     the same run after a longer pause, while the book stays
//     FINAL_GENERATING (the parent just sees "being drawn");
//   - only then does the book go to FAILED, and the periodic recovery sweep
//     (recoverStalledBooks) restarts it later, within a per-book budget.
// After the last page is accepted the PDF and the narration are produced
// right away (bookFinishingService) instead of waiting for a button.
// ============================================================

const PAGE_ATTEMPTS_PER_ROUND = 3;
const AUTO_ROUNDS = 3;
// Hard cap on paid image calls per book across every run and sweep, so a
// permanent failure can never loop forever: ~4 tries per page on average.
const MAX_FINAL_PAGE_EVENTS_PER_PAGE = 4;
// Classifications that a wait cannot fix (wrong key/deployment) end the run.
const NON_RETRYABLE: ReadonlySet<string> = new Set(['AUTHENTICATION_OR_ACCESS', 'DEPLOYMENT_OR_ENDPOINT']);

// Overridable in tests so failure paths don't sleep for real.
export const bookGenerationTiming = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  pageRetryDelayMs(classification: string | null, attempt: number): number {
    if (classification === 'QUOTA_OR_RATE_LIMIT') return 30_000 * attempt;
    return 5_000 * attempt;
  },
  roundDelayMs(round: number): number {
    return 60_000 * round;
  },
};

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

function buildPagePrompt(params: {
  characterBible: any;
  styleBible: any;
  planPage: StoryPlan['pages'][number] | undefined;
  storyText: string | null;
  pageNumber: number;
  hasPortrait: boolean;
  cast: BookCast | null;
  hasCastSheet: boolean;
  safer: boolean;
  dropStoryText: boolean;
}): string {
  const { characterBible, styleBible, planPage } = params;
  return [
    `Children's storybook illustration.`,
    illustrationStylePromptLine(styleBible?.illustrationStyle),
    `Character: ${characterBible?.name ?? ''}, consistent with the approved Character Bible.`,
    consistencyPromptLine(params.hasPortrait),
    params.hasPortrait && params.hasCastSheet ? 'The FIRST reference image is the main character portrait.' : '',
    params.dropStoryText ? pageStoryPromptLines(characterBible, null) : pageStoryPromptLines(characterBible, params.storyText),
    appearancePromptLine(characterBible),
    siblingsPromptLine(characterBible),
    extraCharactersPromptLine(characterBible),
    castPromptLine(params.cast, params.pageNumber, params.hasCastSheet),
    planPage ? `Scene: ${planPage.sceneDescription}. Composition: ${planPage.composition}.` : '',
    params.safer ? 'A gentle, wholesome, family-friendly picture-book scene for young children; everyone fully clothed, nothing scary.' : '',
    'No readable text or letters anywhere in the image. Reserve the upper-left 30% free of detail.',
  ].filter(Boolean).join(' ');
}

async function runFinalGeneration(bookProjectId: string): Promise<void> {
  const book = await prisma.bookProject.findUnique({ where: { id: bookProjectId }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!book) return;

  const storyPlan = book.storyPlan as unknown as StoryPlan;
  const characterBible = book.characterBible as any;
  const styleBible = book.styleBible as any;
  // Loaded once per run: the approved portrait is the reference for every
  // page so the child keeps the same look and outfit throughout.
  const portrait = await loadCharacterReference(characterBible);
  // Recurring companions (creatures, animals) get one fixed design and a
  // character sheet, reused by every page and every later run.
  const { cast, sheetReference } = await ensureBookCast({
    bookId: book.id,
    storyPlan,
    characterBible,
    illustrationStyle: styleBible?.illustrationStyle,
    pages: book.pages.map((p) => ({ pageNumber: p.pageNumber, storyText: p.storyText })),
    saveCast: async (newCast) => {
      const fresh = await prisma.bookProject.findUnique({ where: { id: book.id }, select: { storyPlan: true } });
      await prisma.bookProject.update({ where: { id: book.id }, data: { storyPlan: { ...((fresh?.storyPlan as any) ?? {}), cast: newCast } as any } });
    },
  });
  const referenceImages = [...portrait, ...sheetReference];
  const eventBudget = book.pageCount * MAX_FINAL_PAGE_EVENTS_PER_PAGE;

  let stopReason: string | null = null;
  for (let round = 0; round <= AUTO_ROUNDS && !stopReason; round += 1) {
    const pending = await prisma.bookPage.findMany({ where: { bookProjectId: book.id, acceptedEventId: null }, orderBy: { pageNumber: 'asc' } });
    if (pending.length === 0) break;
    if (round > 0) {
      console.log(`[childrens-book] ${book.id}: ${pending.length} page(s) still missing, automatic round ${round + 1} after a pause`);
      await bookGenerationTiming.sleep(bookGenerationTiming.roundDelayMs(round));
    }

    for (const page of pending) {
      if (stopReason) break;
      const planPage = storyPlan.pages.find((p) => p.pageNumber === page.pageNumber);
      let lastClassification: string | null = null;

      for (let attempt = 0; attempt < PAGE_ATTEMPTS_PER_ROUND; attempt += 1) {
        const totalEvents = await prisma.bookGenerationEvent.count({ where: { bookProjectId: book.id, operationType: 'FINAL_PAGE', revisionVersion: 0 } });
        if (totalEvents >= eventBudget) {
          stopReason = 'attempt budget used up';
          break;
        }
        if (attempt > 0) await bookGenerationTiming.sleep(bookGenerationTiming.pageRetryDelayMs(lastClassification, attempt));

        const previousAttempts = await prisma.bookGenerationEvent.count({
          where: { bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 },
        });
        const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 });
        // A content-filter refusal is usually triggered by the wording, so
        // the retries soften the prompt (and finally drop the page text).
        const filtered = lastClassification === 'CONTENT_FILTER';
        const prompt = buildPagePrompt({
          characterBible,
          styleBible,
          planPage,
          storyText: page.storyText,
          pageNumber: page.pageNumber,
          hasPortrait: portrait.length > 0,
          cast,
          hasCastSheet: sheetReference.length > 0,
          safer: filtered,
          dropStoryText: filtered && attempt >= 2,
        });

        await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'GENERATING', attemptCount: { increment: 1 } } });

        const started = new Date();
        const result = await generateBookImage({ prompt, size: '1024x1024', quality: book.finalQuality === 'high' ? 'high' : 'medium', referenceImages });
        const completed = new Date();
        const qa = runImageQa({ imageSuccess: result.success, byteSize: result.success ? result.byteSize : 0 });
        const accepted = result.success && isAcceptableQaStatus(qa.status);
        lastClassification = result.success ? (accepted ? null : 'REQUEST_SCHEMA') : result.errorClassification;

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
            success: accepted,
            errorClassification: lastClassification as any,
            startedAt: started,
            completedAt: completed,
          },
        });

        if (result.success && accepted) {
          const key = `books/${book.id}/events/${event.id}.png`;
          await storeBookAsset(key, result.buffer, result.mimeType);
          await prisma.bookPage.update({
            where: { id: page.id },
            data: { imageGenerationStatus: 'READY', qaStatus: qa.status, acceptedEventId: event.id, sceneSpec: { ...(page.sceneSpec as any), imageKey: key, imageMimeType: result.mimeType } as any },
          });
          break;
        }
        console.warn(`[childrens-book] page ${page.pageNumber} of ${book.id} failed (round ${round + 1}, attempt ${attempt + 1}): ${lastClassification}${result.success ? '' : ` ${result.safeErrorMessage}`}`);
        // Stays "pending" (not FAILED) while automatic retries remain, so
        // the progress view never flashes an error at the parent.
        await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'PENDING', qaStatus: 'FAIL' } });
        if (lastClassification && NON_RETRYABLE.has(lastClassification)) {
          stopReason = `non-retryable error ${lastClassification}`;
          break;
        }
      }
    }
  }

  const acceptedCount = await prisma.bookPage.count({ where: { bookProjectId: book.id, acceptedEventId: { not: null } } });
  if (acceptedCount === book.pageCount) {
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_GENERATING' }, data: { status: 'FINAL_QA' } });
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_QA' }, data: { status: 'FINAL_READY' } });
    await finishBook(book.id, { drawCoverImage: true });
  } else {
    console.error(`[childrens-book] ${book.id}: ${book.pageCount - acceptedCount} page(s) still missing after automatic retries${stopReason ? ` (${stopReason})` : ''}; the recovery sweep will try again later`);
    await prisma.bookPage.updateMany({ where: { bookProjectId: book.id, acceptedEventId: null }, data: { imageGenerationStatus: 'FAILED' } });
    await prisma.bookProject.updateMany({ where: { id: book.id, status: { in: ['FINAL_GENERATING', 'FINAL_QA'] } }, data: { status: 'FAILED' } });
  }
}

// ============================================================
// Recovery sweep (every few minutes from server.ts):
//   - paid books that ended FAILED are restarted while they still have
//     attempt budget left (a FAILED book with a Character Bible always came
//     from final generation, i.e. was paid);
//   - finished books missing their PDF, or their narration when the audio
//     add-on was bought, are finished.
// Only books touched in the last RECOVERY_WINDOW_DAYS are looked at.
// ============================================================
const RECOVERY_WINDOW_DAYS = 14;
const finishingInFlight = new Set<string>();

export async function recoverStalledBooks(): Promise<{ restarted: number; finished: number }> {
  const since = new Date(Date.now() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let restarted = 0;
  let finished = 0;

  const failed = await prisma.bookProject.findMany({
    where: { status: 'FAILED', updatedAt: { gte: since }, characterBible: { not: Prisma.AnyNull } },
    select: { id: true, pageCount: true },
  });
  for (const book of failed) {
    const used = await prisma.bookGenerationEvent.count({ where: { bookProjectId: book.id, operationType: 'FINAL_PAGE', revisionVersion: 0 } });
    if (used >= book.pageCount * MAX_FINAL_PAGE_EVENTS_PER_PAGE) continue;
    if ((await startFinalGeneration(book.id)) === 'STARTED') restarted += 1;
  }

  const unfinished = await prisma.bookProject.findMany({
    where: {
      status: { in: ['FINAL_READY', 'COMPLETED'] },
      updatedAt: { gte: since },
      OR: [{ pdfStatus: { in: ['NONE', 'FAILED', 'STALE'] } }, { audioAddOnPurchased: true }],
    },
    select: { id: true, pageCount: true, pdfStatus: true, audioAddOnPurchased: true },
  });
  // Stored PDFs from before the current layout (cover, title page, back
  // cover with QR codes) are rebuilt once. No image is generated for that.
  const outdated = await prisma.bookProject.findMany({
    where: { status: { in: ['FINAL_READY', 'COMPLETED'] }, pdfStatus: 'CURRENT', updatedAt: { gte: since } },
    select: { id: true, pageCount: true, pdfStatus: true, audioAddOnPurchased: true, storyPlan: true },
  });
  for (const book of outdated) {
    if (readExtras(book.storyPlan).pdfLayout === BOOK_PDF_LAYOUT_VERSION || finishingInFlight.has(book.id) || inFlight.has(book.id)) continue;
    const marked = await prisma.bookProject.updateMany({ where: { id: book.id, pdfStatus: 'CURRENT' }, data: { pdfStatus: 'STALE' } });
    if (marked.count === 1 && !unfinished.some((b) => b.id === book.id)) unfinished.push({ id: book.id, pageCount: book.pageCount, pdfStatus: 'STALE', audioAddOnPurchased: book.audioAddOnPurchased });
    else if (marked.count === 1) unfinished.find((b) => b.id === book.id)!.pdfStatus = 'STALE';
  }
  for (const book of unfinished) {
    if (finishingInFlight.has(book.id) || inFlight.has(book.id)) continue;
    let needsWork = book.pdfStatus !== 'CURRENT';
    if (!needsWork && book.audioAddOnPurchased) {
      const readyAudio = await prisma.bookNarrationArtifact.count({ where: { bookProjectId: book.id, status: 'READY', artifactKey: { not: null }, revisionVersion: 0 } });
      needsWork = readyAudio < book.pageCount;
    }
    if (!needsWork) continue;
    finishingInFlight.add(book.id);
    try {
      await finishBook(book.id);
      finished += 1;
    } finally {
      finishingInFlight.delete(book.id);
    }
  }
  if (restarted || finished) console.log(`[childrens-book] recovery sweep: restarted=${restarted} finished=${finished}`);
  return { restarted, finished };
}
