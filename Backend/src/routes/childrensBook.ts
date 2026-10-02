import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import {
  isSupportedLanguage,
  isValidPageNumber,
  isAllowedPageCount,
  calculateBookPrice,
  canApproveCharacter,
  canStartFinalGeneration,
  canClaimRevision,
  canGeneratePdf,
  canComplete,
  buildLogicalOperationKey,
} from '../services/bookStateService';
import { generateStoryPlan, CharacterConfig, StoryPlan } from '../services/bookStoryPlanService';
import { generateBookImage, isImageGenerationMocked } from '../services/bookImageGenerationService';
import { runImageQa } from '../services/bookQaService';
import { buildBookPdf, BookPdfPageInput } from '../services/bookPdfService';
import { storeBookAsset, getBookAssetUrl, readLocalBookAsset, isUsingCloudBookStorage } from '../services/bookStorageService';
import { isBookDevPaymentSimulationEnabled } from '../services/bookMockConfig';
import { completeChildrensBookPurchase } from '../services/bookPurchaseFulfillment';
import { calculateAudioPrice, calculateTotalBookPrice, canGenerateNarration, MockBookNarrationProvider, narrationLanguageForBook } from '../services/bookNarrationService';

const router = Router();
const narrationProvider = new MockBookNarrationProvider();

// Only one illustration style is wired to real generation today (Phase
// 2/2B/3/4's validated Character Bible / Style Bible pilots) — every other
// value on the product's style selector must stay purely cosmetic
// ("Coming Soon") until its own pilot exists. Enforced server-side, not
// just hidden in the UI, per FAST BUILD MODE's own instruction.
const VALIDATED_ILLUSTRATION_STYLES = ['STORYBOOK_WATERCOLOR'] as const;

function isOwner(book: { userId: string } | null, userId: string): book is { userId: string } {
  return !!book && book.userId === userId;
}

// ============================================================
// CREATE
// ============================================================
router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const { language, title, character, illustrationStyle, pageCount, audioAddOnPurchased } = req.body ?? {};
  if (typeof language !== 'string' || !isSupportedLanguage(language)) {
    return res.status(400).json({ message: 'language must be KA or EN.' });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: 'title is required.' });
  }
  if (!character || typeof character !== 'object' || typeof character.name !== 'string' || !character.name.trim()) {
    return res.status(400).json({ message: 'character.name is required.' });
  }
  const style = typeof illustrationStyle === 'string' ? illustrationStyle : VALIDATED_ILLUSTRATION_STYLES[0];
  if (!VALIDATED_ILLUSTRATION_STYLES.includes(style as typeof VALIDATED_ILLUSTRATION_STYLES[number])) {
    return res.status(400).json({ message: 'This illustration style is coming soon and is not available for real generation yet.' });
  }
  // Server decides the price — pageCount is the only thing the client
  // chooses, and even that is validated against the fixed allowed set
  // before calculateBookPrice() ever runs; a price field on the request
  // body (if any) is never read here at all.
  if (typeof pageCount !== 'number' || !isAllowedPageCount(pageCount)) {
    return res.status(400).json({ message: 'pageCount must be one of 5, 10, 15, 20.' });
  }
  const priceGel = calculateBookPrice(pageCount);
  const includesAudio = Boolean(audioAddOnPurchased);
  const audioPriceGel = calculateAudioPrice(includesAudio);
  const totalPriceGel = calculateTotalBookPrice(priceGel, includesAudio);

  const book = await prisma.bookProject.create({
    data: {
      userId: req.user!.id,
      language,
      title: title.trim(),
      illustrationStyle: style,
      characterConfig: character,
      priceGel,
      pageCount,
      audioAddOnPurchased: includesAudio,
      audioPriceGel,
      totalPriceGel,
    },
  });
  res.status(201).json({ data: book });
});

// ============================================================
// MY BOOKS — list
// ============================================================
router.get('/', authenticate, async (req: Request, res: Response) => {
  const books = await prisma.bookProject.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      language: true,
      status: true,
      pdfStatus: true,
      createdAt: true,
      updatedAt: true,
      illustrationStyle: true,
      pageCount: true,
      priceGel: true,
      audioAddOnPurchased: true,
      audioPriceGel: true,
      totalPriceGel: true,
    },
  });
  res.json({ data: books });
});

// ============================================================
// GET ONE (with pages)
// ============================================================
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
  });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  res.json({ data: book, mocked: isImageGenerationMocked(), devPaymentSimulationEnabled: isBookDevPaymentSimulationEnabled() });
});

// ============================================================
// UPDATE CHARACTER CONFIG (DRAFT only — nothing locked yet)
// ============================================================
router.put('/:id/character-config', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (book.status !== 'DRAFT') {
    return res.status(400).json({ message: 'Character setup can only be edited before the story plan is generated.' });
  }
  const { character, title } = req.body ?? {};
  if (character && typeof character !== 'object') return res.status(400).json({ message: 'Invalid character payload.' });

  const updated = await prisma.bookProject.update({
    where: { id: book.id },
    data: {
      characterConfig: character ?? book.characterConfig ?? undefined,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
    },
  });
  res.json({ data: updated });
});

router.patch('/:id/audio-upgrade', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  if (book.status === 'PAID' || book.status === 'FINAL_GENERATING' || book.status === 'FINAL_QA' || book.status === 'FINAL_READY' || book.status === 'COMPLETED') {
    return res.status(400).json({ message: 'Audio add-on cannot be changed after payment has been completed.' });
  }

  const audioAddOnPurchased = Boolean(req.body?.audioAddOnPurchased);
  const audioPriceGel = calculateAudioPrice(audioAddOnPurchased);
  const totalPriceGel = calculateTotalBookPrice(book.priceGel, audioAddOnPurchased);

  const updated = await prisma.bookProject.update({
    where: { id: book.id },
    data: {
      audioAddOnPurchased,
      audioPriceGel,
      totalPriceGel,
    },
  });

  res.json({ data: updated });
});

// ============================================================
// STORY PLAN
// ============================================================
router.post('/:id/story-plan', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  if (book.status !== 'DRAFT') {
    if (book.status === 'STORY_PLAN_READY' && book.storyPlan) {
      return res.json({ data: book, note: 'Story plan already exists.' });
    }
    return res.status(400).json({ message: `Story plan cannot be generated from status ${book.status}.` });
  }

  const character = (book.characterConfig ?? {}) as unknown as CharacterConfig;
  const plan: StoryPlan = generateStoryPlan({ title: book.title, character, language: book.language, pageCount: book.pageCount });

  const claim = await prisma.bookProject.updateMany({
    where: { id: book.id, status: 'DRAFT' },
    data: { status: 'STORY_PLAN_READY', storyPlan: plan as any },
  });
  if (claim.count !== 1) {
    return res.status(409).json({ message: 'Story plan generation already in progress or completed.' });
  }

  await prisma.bookPage.createMany({
    data: plan.pages.map((p) => ({
      bookProjectId: book.id,
      pageNumber: p.pageNumber,
      storyText: p.storyText,
      sceneSpec: p as any,
    })),
    skipDuplicates: true,
  });

  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  res.status(201).json({ data: fresh });
});

// ============================================================
// CHARACTER PREVIEW
// ============================================================
router.post('/:id/character-preview', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const eligibleFromStates: string[] = ['STORY_PLAN_READY', 'FAILED'];
  if (eligibleFromStates.includes(book.status)) {
    const claim = await prisma.bookProject.updateMany({
      where: { id: book.id, status: { in: eligibleFromStates as any } },
      data: { status: 'CHARACTER_PREVIEW_GENERATING' },
    });
    if (claim.count !== 1) return res.status(409).json({ message: 'Character preview generation already starting elsewhere.' });
  } else if (book.status !== 'CHARACTER_PREVIEW_GENERATING') {
    return res.status(400).json({ message: `Character preview cannot be generated from status ${book.status}.` });
  }

  const character = (book.characterConfig ?? {}) as unknown as CharacterConfig;
  const previousAttempts = await prisma.bookGenerationEvent.count({
    where: { bookProjectId: book.id, operationType: 'CHARACTER_PREVIEW', revisionVersion: 0 },
  });
  const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'CHARACTER_PREVIEW', pageNumber: null, revisionVersion: 0 });
  const attemptNumber = previousAttempts + 1;

  // Locked Phase 2B prompt rules (BODY PROPORTION LOCK / LINEWORK LOCK /
  // TEXT-SAFE LOCK) summarized here, not reproduced verbatim — the real
  // validated wording lives in scripts/gpt-image-2-character-pilot-2b.ts.
  const prompt = [
    `Children's storybook character design, STORYBOOK_WATERCOLOR style.`,
    `Character: ${character.name}${character.age ? `, age ${character.age}` : ''}.`,
    character.traits?.length ? `Traits: ${character.traits.join(', ')}.` : '',
    character.favoriteThing ? `Favorite thing: ${character.favoriteThing}.` : '',
    'Soft watercolor textures, consistent body proportions, delicate clean linework, no readable text or letters anywhere in the image, reserve the upper-left 30% free of detail.',
  ].filter(Boolean).join(' ');

  const started = new Date();
  const result = await generateBookImage({ prompt, size: '1024x1024', quality: 'low' });
  const completed = new Date();

  const event = await prisma.bookGenerationEvent.create({
    data: {
      bookProjectId: book.id,
      pageNumber: null,
      operationType: 'CHARACTER_PREVIEW',
      logicalOperationKey,
      attemptNumber,
      revisionVersion: 0,
      deployment: result.deployment,
      quality: 'low',
      requestedSize: '1024x1024',
      requestId: result.success ? result.requestId : result.requestId,
      latencyMs: result.latencyMs,
      success: result.success,
      errorClassification: result.success ? null : result.errorClassification,
      startedAt: started,
      completedAt: completed,
    },
  });

  if (!result.success) {
    await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'FAILED' } });
    return res.status(502).json({ message: 'Character preview generation failed.', errorClassification: result.errorClassification, mocked: isImageGenerationMocked() });
  }

  const imageKey = `books/${book.id}/character-preview-${event.id}.png`;
  await storeBookAsset(imageKey, result.buffer, result.mimeType);

  const updated = await prisma.bookProject.update({
    where: { id: book.id },
    data: {
      status: 'CHARACTER_PREVIEW_READY',
      characterConfig: { ...character, previewImageKey: imageKey, previewImageMimeType: result.mimeType, previewEventId: event.id } as any,
    },
  });

  res.status(201).json({ data: updated, eventId: event.id, mocked: isImageGenerationMocked() });
});

// ============================================================
// CHARACTER PREVIEW — image fetch (ownership-gated)
// ============================================================
router.get('/:id/character-preview/image', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  const config = (book.characterConfig ?? {}) as any;
  if (!config.previewImageKey) return res.status(404).json({ message: 'No character preview image yet.' });

  if (isUsingCloudBookStorage()) {
    const url = await getBookAssetUrl(config.previewImageKey);
    return res.redirect(url!);
  }
  try {
    const buffer = await readLocalBookAsset(config.previewImageKey);
    res.setHeader('Content-Type', config.previewImageMimeType || 'image/png');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Preview image not found on disk.' });
  }
});

router.get('/:id/page/:pageNumber/image', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: true } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  const pageNumber = Number(req.params.pageNumber);
  const page = book.pages.find((entry) => entry.pageNumber === pageNumber);
  const scene = page?.sceneSpec as any;
  if (!page || !scene?.imageKey) return res.status(404).json({ message: 'Page illustration not found.' });

  if (isUsingCloudBookStorage()) {
    const url = await getBookAssetUrl(scene.imageKey);
    return url ? res.redirect(url) : res.status(404).json({ message: 'Page illustration not available.' });
  }
  try {
    const buffer = await readLocalBookAsset(scene.imageKey);
    res.setHeader('Content-Type', scene.imageMimeType || 'image/png');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Page illustration not found on disk.' });
  }
});

// ============================================================
// CHARACTER APPROVAL — locks Character Bible / Style Bible
// ============================================================
router.post('/:id/character-approval', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (!canApproveCharacter({ status: book.status })) {
    return res.status(400).json({ message: `Character cannot be approved from status ${book.status}.` });
  }

  const character = (book.characterConfig ?? {}) as any;
  const characterBible = { name: character.name, age: character.age, traits: character.traits, favoriteThing: character.favoriteThing, previewImageKey: character.previewImageKey };
  const styleBible = { illustrationStyle: book.illustrationStyle };

  const claim = await prisma.bookProject.updateMany({
    where: { id: book.id, status: 'CHARACTER_PREVIEW_READY' },
    data: { status: 'CHARACTER_APPROVED', characterBible: characterBible as any, styleBible: styleBible as any, characterBibleVersion: 1 },
  });
  if (claim.count !== 1) return res.status(409).json({ message: 'Character approval already in progress or completed.' });

  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id } });
  res.json({ data: fresh });
});

// ============================================================
// DEV-ONLY PAYMENT SIMULATION — never active in production, never active
// without the explicit opt-in env flag (see bookMockConfig.ts). Mirrors
// what a real completed BOG webhook would do, without a real charge.
// ============================================================
router.post('/:id/payment/dev-simulate', authenticate, async (req: Request, res: Response) => {
  if (!isBookDevPaymentSimulationEnabled()) {
    return res.status(403).json({ message: 'Dev payment simulation is not enabled on this server.' });
  }
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (book.status === 'CHARACTER_APPROVED') {
    const claimed = await prisma.bookProject.updateMany({
      where: { id: book.id, status: 'CHARACTER_APPROVED' },
      data: { status: 'PAYMENT_PENDING' },
    });
    if (claimed.count !== 1) return res.status(409).json({ message: 'Book payment simulation already started.' });
  } else if (book.status !== 'PAYMENT_PENDING') {
    return res.status(400).json({ message: `Payment cannot be simulated from status ${book.status}.` });
  }

  // Deliberately create no BogPayment row and no external order in this
  // explicitly enabled local-only path.
  const result = await completeChildrensBookPurchase({ bookProjectId: book.id });
  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id } });
  res.json({ data: fresh, handled: result.handled });
});

// ============================================================
// FINAL GENERATION — start/resume (synchronous; mock mode is near-instant,
// real mode would be slow but this is local-dev-only for now). Per-page
// retry: only pages without an accepted artifact are (re)generated.
// ============================================================
router.post('/:id/final-generation/start', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  if (!canStartFinalGeneration({ status: book.status, characterBible: book.characterBible, styleBible: book.styleBible, storyPlan: book.storyPlan })) {
    return res.status(400).json({ message: `Final generation cannot start from status ${book.status}.` });
  }

  if (book.status === 'PAID') {
    const claim = await prisma.bookProject.updateMany({ where: { id: book.id, status: 'PAID' }, data: { status: 'FINAL_GENERATING' } });
    if (claim.count !== 1) return res.status(409).json({ message: 'Final generation already starting elsewhere.' });
  }

  const storyPlan = book.storyPlan as unknown as StoryPlan;
  const characterBible = book.characterBible as any;
  const styleBible = book.styleBible as any;

  for (const page of book.pages) {
    if (page.acceptedEventId) continue; // already accepted — per-page retry only touches unfinished pages

    const planPage = storyPlan.pages.find((p) => p.pageNumber === page.pageNumber);
    const previousAttempts = await prisma.bookGenerationEvent.count({
      where: { bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 },
    });
    const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'FINAL_PAGE', pageNumber: page.pageNumber, revisionVersion: 0 });

    const prompt = [
      `Children's storybook illustration, ${styleBible?.illustrationStyle ?? 'STORYBOOK_WATERCOLOR'} style.`,
      `Character: ${characterBible?.name ?? ''}, consistent with the approved Character Bible.`,
      planPage ? `Scene: ${planPage.sceneDescription}. Composition: ${planPage.composition}.` : '',
      'No readable text or letters anywhere in the image. Reserve the upper-left 30% free of detail.',
    ].filter(Boolean).join(' ');

    await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'GENERATING', attemptCount: { increment: 1 } } });

    const started = new Date();
    const result = await generateBookImage({ prompt, size: '1024x1024', quality: book.finalQuality === 'high' ? 'high' : 'medium' });
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
        quality: result.success ? 'medium' : 'medium',
        requestedSize: '1024x1024',
        requestId: result.success ? result.requestId : result.requestId,
        latencyMs: result.latencyMs,
        success: result.success && qa.status === 'PASS',
        errorClassification: result.success ? (qa.status === 'PASS' ? null : 'REQUEST_SCHEMA') : result.errorClassification,
        startedAt: started,
        completedAt: completed,
      },
    });

    if (result.success && qa.status === 'PASS') {
      const key = `books/${book.id}/events/${event.id}.png`;
      await storeBookAsset(key, result.buffer, result.mimeType);
      await prisma.bookPage.update({
        where: { id: page.id },
        data: { imageGenerationStatus: 'READY', qaStatus: 'PASS', acceptedEventId: event.id, sceneSpec: { ...(page.sceneSpec as any), imageKey: key, imageMimeType: result.mimeType } as any },
      });
    } else {
      await prisma.bookPage.update({ where: { id: page.id }, data: { imageGenerationStatus: 'FAILED', qaStatus: 'FAIL' } });
    }
  }

  const refreshedPages = await prisma.bookPage.findMany({ where: { bookProjectId: book.id } });
  const acceptedCount = refreshedPages.filter((p) => p.acceptedEventId).length;

  if (acceptedCount === book.pageCount) {
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_GENERATING' }, data: { status: 'FINAL_QA' } });
    await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_QA' }, data: { status: 'FINAL_READY' } });
  } else {
    await prisma.bookProject.updateMany({ where: { id: book.id, status: { in: ['FINAL_GENERATING', 'FINAL_QA'] } }, data: { status: 'FAILED' } });
  }

  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  res.json({ data: fresh, acceptedCount, mocked: isImageGenerationMocked() });
});

router.get('/:id/final-generation/status', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  res.json({
    data: {
      status: book.status,
      pages: book.pages.map((p) => ({ pageNumber: p.pageNumber, imageGenerationStatus: p.imageGenerationStatus, qaStatus: p.qaStatus, accepted: !!p.acceptedEventId })),
    },
  });
});

// ============================================================
// REVISION — exactly one successful revision per book, atomic claim,
// failure never consumes it (see bookStateService.canClaimRevision).
// ============================================================
router.post('/:id/revision', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: true } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const { pageNumber, note } = req.body ?? {};
  if (typeof pageNumber !== 'number' || !isValidPageNumber(pageNumber, book.pageCount)) {
    return res.status(400).json({ message: `pageNumber must be between 1 and ${book.pageCount}.` });
  }
  if (!canClaimRevision({ status: book.status, revisionUsed: book.revisionUsed })) {
    return res.status(400).json({ message: 'No revision is available for this book.' });
  }

  const claim = await prisma.bookProject.updateMany({
    where: { id: book.id, status: { in: ['FINAL_READY', 'COMPLETED'] }, revisionUsed: false },
    data: { status: 'REVISION_REQUESTED' },
  });
  if (claim.count !== 1) return res.status(409).json({ message: 'Revision already claimed elsewhere.' });

  await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'REVISION_GENERATING' } });

  const page = book.pages.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'FINAL_READY' } });
    return res.status(404).json({ message: 'Page not found.' });
  }

  const characterBible = book.characterBible as any;
  const styleBible = book.styleBible as any;
  const planPage = (book.storyPlan as unknown as StoryPlan)?.pages?.find((p) => p.pageNumber === pageNumber);
  const prompt = [
    `Children's storybook illustration revision, ${styleBible?.illustrationStyle ?? 'STORYBOOK_WATERCOLOR'} style.`,
    `Character: ${characterBible?.name ?? ''}, consistent with the approved Character Bible.`,
    planPage ? `Original scene: ${planPage.sceneDescription}.` : '',
    typeof note === 'string' && note.trim() ? `Requested change: ${note.trim()}.` : '',
    'No readable text or letters anywhere in the image.',
  ].filter(Boolean).join(' ');

  const previousAttempts = await prisma.bookGenerationEvent.count({
    where: { bookProjectId: book.id, operationType: 'REVISION', pageNumber, revisionVersion: 1 },
  });
  const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'REVISION', pageNumber, revisionVersion: 1 });

  const started = new Date();
  const result = await generateBookImage({ prompt, size: '1024x1024', quality: 'medium' });
  const completed = new Date();
  const qa = runImageQa({ imageSuccess: result.success, byteSize: result.success ? result.byteSize : 0 });

  const event = await prisma.bookGenerationEvent.create({
    data: {
      bookProjectId: book.id,
      pageNumber,
      operationType: 'REVISION',
      logicalOperationKey,
      attemptNumber: previousAttempts + 1,
      revisionVersion: 1,
      deployment: result.deployment,
      quality: 'medium',
      requestedSize: '1024x1024',
      requestId: result.success ? result.requestId : result.requestId,
      latencyMs: result.latencyMs,
      success: result.success && qa.status === 'PASS',
      errorClassification: result.success ? (qa.status === 'PASS' ? null : 'REQUEST_SCHEMA') : result.errorClassification,
      startedAt: started,
      completedAt: completed,
    },
  });

  if (result.success && qa.status === 'PASS') {
    const key = `books/${book.id}/events/${event.id}.png`;
    await storeBookAsset(key, result.buffer, result.mimeType);
    let revisedNarration: Awaited<ReturnType<typeof narrationProvider.generatePageNarration>> | null = null;
    if (book.audioAddOnPurchased) {
      try {
        revisedNarration = await narrationProvider.generatePageNarration({
          bookProjectId: book.id,
          pageNumber,
          revisionVersion: 1,
          language: narrationLanguageForBook(book.language),
          text: page.storyText ?? '',
        });
        await storeBookAsset(revisedNarration.storageKey, revisedNarration.buffer, revisedNarration.mimeType);
      } catch {
        await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'FINAL_READY' } });
        return res.status(502).json({ message: 'The revised page audio could not be prepared; the revision remains available.' });
      }
    }

    if (revisedNarration) {
      await prisma.bookNarrationArtifact.upsert({
        where: { bookProjectId_pageNumber_revisionVersion: { bookProjectId: book.id, pageNumber, revisionVersion: 1 } },
        update: {
          status: 'READY',
          language: revisedNarration.language,
          mimeType: revisedNarration.mimeType,
          artifactKey: revisedNarration.storageKey,
          attemptCount: { increment: 1 },
        },
        create: {
          bookProjectId: book.id,
          pageNumber,
          revisionVersion: 1,
          status: 'READY',
          language: revisedNarration.language,
          mimeType: revisedNarration.mimeType,
          artifactKey: revisedNarration.storageKey,
          attemptCount: 1,
        },
      });
    }

    await prisma.bookPage.update({
      where: { id: page.id },
      data: { revisionVersion: 1, acceptedEventId: event.id, qaStatus: 'PASS', sceneSpec: { ...(page.sceneSpec as any), imageKey: key, imageMimeType: result.mimeType } as any },
    });
    await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'FINAL_READY', revisionUsed: true, pdfStatus: 'STALE' } });
  } else {
    // Failure: revisionUsed stays false — the revision is still available.
    await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'FINAL_READY' } });
  }

  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id } });
  res.json({ data: fresh, eventId: event.id, qa: qa.status, mocked: isImageGenerationMocked() });
});

// ============================================================
// AUDIO STORY — mock-only in local dev
// ============================================================
router.get('/:id/audio/status', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { narrationArtifacts: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  res.json({
    data: {
      audioAddOnPurchased: !!book.audioAddOnPurchased,
      audioPriceGel: book.audioPriceGel,
      totalPriceGel: book.totalPriceGel,
      eligible: canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status }),
      artifacts: book.narrationArtifacts.map((artifact) => ({
        id: artifact.id,
        pageNumber: artifact.pageNumber,
        revisionVersion: artifact.revisionVersion,
        status: artifact.status,
        language: artifact.language,
        mimeType: artifact.mimeType,
      })),
    },
  });
});

router.post('/:id/audio/generate', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  if (!canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status })) {
    return res.status(400).json({ message: 'Audio narration is only available for a paid, audio-enabled book.' });
  }

  const artifacts = [] as any[];
  for (const page of book.pages) {
    const storyText = page.storyText ?? '';
    const existing = await prisma.bookNarrationArtifact.findUnique({
      where: {
        bookProjectId_pageNumber_revisionVersion: {
          bookProjectId: book.id,
          pageNumber: page.pageNumber,
          revisionVersion: 0,
        },
      },
    });

    const result = await narrationProvider.generatePageNarration({
      bookProjectId: book.id,
      pageNumber: page.pageNumber,
      revisionVersion: 0,
      language: narrationLanguageForBook(book.language),
      text: storyText,
    });

    await storeBookAsset(result.storageKey, result.buffer, result.mimeType);

    if (existing) {
      const updated = await prisma.bookNarrationArtifact.update({
        where: { id: existing.id },
        data: {
          status: 'READY',
          language: result.language,
          mimeType: result.mimeType,
          artifactKey: result.storageKey,
          attemptCount: { increment: 1 },
        },
      });
      artifacts.push(updated);
    } else {
      const created = await prisma.bookNarrationArtifact.create({
        data: {
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
      artifacts.push(created);
    }
  }

  res.status(201).json({
    data: {
      audioAddOnPurchased: true,
      audioPriceGel: book.audioPriceGel,
      totalPriceGel: book.totalPriceGel,
      eligible: true,
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        pageNumber: artifact.pageNumber,
        revisionVersion: artifact.revisionVersion,
        status: artifact.status,
        language: artifact.language,
        mimeType: artifact.mimeType,
      })),
    },
  });
});

router.post('/:id/audio/revision', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const pageNumber = Number(req.body?.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > book.pageCount) {
    return res.status(400).json({ message: 'Invalid pageNumber for narration revision.' });
  }
  if (!canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status })) {
    return res.status(400).json({ message: 'Audio narration revision is available only after payment.' });
  }
  return res.status(400).json({ message: 'Revise a book page to regenerate its narration; page audio is revised together with the illustration.' });
});

router.get('/:id/audio/page/:pageNumber', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const pageNumber = Number(req.params.pageNumber);
  const artifact = await prisma.bookNarrationArtifact.findFirst({
    where: { bookProjectId: book.id, pageNumber, status: 'READY' },
    orderBy: { revisionVersion: 'desc' },
  });

  if (!artifact || !artifact.artifactKey) {
    return res.status(404).json({ message: 'No narration has been generated for this page yet.' });
  }

  if (isUsingCloudBookStorage()) {
    const url = await getBookAssetUrl(artifact.artifactKey);
    return url ? res.redirect(url) : res.status(404).json({ message: 'Audio asset not available.' });
  }

  try {
    const buffer = await readLocalBookAsset(artifact.artifactKey);
    res.setHeader('Content-Type', artifact.mimeType || 'audio/wav');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Narration file not found on disk.' });
  }
});

router.get('/:id/audio/full-story', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  return res.json({ data: { available: canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status }) } });
});

// ============================================================
// PDF
// ============================================================
router.post('/:id/pdf', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const acceptedPageCount = book.pages.filter((p) => p.acceptedEventId).length;
  if (!canGeneratePdf({ acceptedPageCount, pageCount: book.pageCount, status: book.status, pdfStatus: book.pdfStatus })) {
    return res.status(400).json({ message: 'PDF cannot be generated yet.' });
  }

  const claim = await prisma.bookProject.updateMany({
    where: { id: book.id, pdfStatus: { in: ['NONE', 'STALE', 'FAILED'] } },
    data: { pdfStatus: 'GENERATING' },
  });
  if (claim.count !== 1) return res.status(409).json({ message: 'PDF generation already in progress.' });

  try {
    const pdfPages: BookPdfPageInput[] = [];
    for (const page of book.pages) {
      const imageKey = (page.sceneSpec as any)?.imageKey as string | undefined;
      const imageMimeType = (page.sceneSpec as any)?.imageMimeType as string | undefined;
      let imageBuffer: Buffer | null = null;
      if (imageKey && !isUsingCloudBookStorage()) {
        try {
          imageBuffer = await readLocalBookAsset(imageKey);
        } catch {
          imageBuffer = null;
        }
      }
      pdfPages.push({ pageNumber: page.pageNumber, storyText: page.storyText ?? '', imageBuffer, imageMimeType: imageMimeType ?? null });
    }

    const pdfBuffer = await buildBookPdf({ title: book.title, dedication: (book.characterConfig as any)?.dedication ?? null, pageCount: book.pageCount, pages: pdfPages });
    const newVersion = book.pdfVersion + 1;
    const pdfKey = `books/${book.id}/final-v${newVersion}.pdf`;
    await storeBookAsset(pdfKey, pdfBuffer, 'application/pdf');

    const updated = await prisma.bookProject.update({
      where: { id: book.id },
      data: { pdfStatus: 'CURRENT', pdfVersion: newVersion, finalPdfBlobRef: pdfKey },
    });

    if (canComplete({ pdfStatus: updated.pdfStatus })) {
      await prisma.bookProject.updateMany({ where: { id: book.id, status: 'FINAL_READY' }, data: { status: 'COMPLETED' } });
    }

    const fresh = await prisma.bookProject.findUnique({ where: { id: book.id } });
    res.status(201).json({ data: fresh });
  } catch (err) {
    await prisma.bookProject.update({ where: { id: book.id }, data: { pdfStatus: 'FAILED' } });
    console.error('[childrens-book] PDF generation failed:', err);
    res.status(500).json({ message: 'PDF generation failed.' });
  }
});

// ============================================================
// PDF DOWNLOAD — repeated download never re-charges, re-generates, or
// consumes a revision; purely a read of whatever finalPdfBlobRef currently
// points at.
// ============================================================
router.get('/:id/pdf/download', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (!book.finalPdfBlobRef) return res.status(404).json({ message: 'No PDF has been generated for this book yet.' });

  if (isUsingCloudBookStorage()) {
    const url = await getBookAssetUrl(book.finalPdfBlobRef);
    return res.redirect(url!);
  }
  try {
    const buffer = await readLocalBookAsset(book.finalPdfBlobRef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${book.title.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf"`);
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'PDF file not found on disk.' });
  }
});

export default router;
