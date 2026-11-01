import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
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
import { storeBookAsset, readBookAsset, deleteBookAsset } from '../services/bookStorageService';
import {
  validateCharacterExtras,
  appearancePromptLine,
  extraCharactersPromptLine,
  photoReferencePromptLine,
  normalizeCharacterPhoto,
  loadReferenceImage,
  ALLOWED_CHARACTER_PHOTO_TYPES,
  MAX_CHARACTER_PHOTO_BYTES,
} from '../services/bookCharacterDetailsService';
import { isBookDevPaymentSimulationEnabled } from '../services/bookMockConfig';
import { completeChildrensBookPurchase } from '../services/bookPurchaseFulfillment';
import { startFinalGeneration } from '../services/bookFinalGenerationService';
import { calculateAudioPrice, calculateTotalBookPrice, canGenerateNarration, narrationLanguageForBook } from '../services/bookNarrationService';
import { getBookNarrationProvider } from '../services/bookNarrationProviders';
import { AzureSpeechError } from '../services/azureSpeechService';

const router = Router();

// Only one illustration style is wired to real generation today (Phase
// 2/2B/3/4's validated Character Bible / Style Bible pilots) — every other
// value on the product's style selector must stay purely cosmetic
// ("Coming Soon") until its own pilot exists. Enforced server-side, not
// just hidden in the UI, per FAST BUILD MODE's own instruction.
const VALIDATED_ILLUSTRATION_STYLES = ['STORYBOOK_WATERCOLOR'] as const;

function isOwner(book: { userId: string } | null, userId: string): book is { userId: string } {
  return !!book && book.userId === userId;
}

// Builds characterConfig from a client payload using only the fields the
// client is allowed to set. Server-owned keys (photoKey, previewImageKey,
// ...) are never read from the request: they point at private storage, so
// a client-supplied value could otherwise make the image routes read an
// asset that belongs to someone else's book.
type CharacterInput = { name: string; age?: number; traits?: string[]; favoriteThing?: string; dedication?: string | null; appearance?: string; extraCharacters?: string };
function sanitizeCharacterInput(raw: any): { ok: true; value: CharacterInput } | { ok: false; message: string } {
  const extras = validateCharacterExtras({ appearance: raw?.appearance, extraCharacters: raw?.extraCharacters });
  if (!extras.ok) return extras;
  const value: CharacterInput = { name: String(raw.name).trim() };
  if (typeof raw.age === 'number' && Number.isFinite(raw.age)) value.age = raw.age;
  if (Array.isArray(raw.traits)) value.traits = raw.traits.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim()).slice(0, 10);
  if (typeof raw.favoriteThing === 'string' && raw.favoriteThing.trim()) value.favoriteThing = raw.favoriteThing.trim();
  if (typeof raw.dedication === 'string' && raw.dedication.trim()) value.dedication = raw.dedication.trim();
  else if (raw.dedication === null) value.dedication = null;
  Object.assign(value, extras.value);
  return { ok: true, value };
}

// Photo of the main character: only before the character is approved,
// since after approval the portrait (and so the look of the whole book) is
// locked.
function canChangeCharacterPhoto(book: { status: string; characterBible: unknown }): boolean {
  if (book.characterBible) return false;
  return ['DRAFT', 'STORY_PLAN_READY', 'CHARACTER_PREVIEW_READY', 'FAILED'].includes(book.status);
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if ((ALLOWED_CHARACTER_PHOTO_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG or WebP photos are allowed.'));
  },
  limits: { fileSize: MAX_CHARACTER_PHOTO_BYTES, files: 1 },
});

function handlePhotoUpload(req: Request, res: Response, next: NextFunction) {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Photo must be at most ${MAX_CHARACTER_PHOTO_BYTES / (1024 * 1024)}MB.` });
    }
    return res.status(400).json({ message: err.message || 'Only JPG, PNG or WebP photos are allowed.' });
  });
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
  const sanitized = sanitizeCharacterInput(character);
  if (!sanitized.ok) return res.status(400).json({ message: sanitized.message });
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
      characterConfig: sanitized.value as any,
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
  let nextConfig: any = undefined;
  if (character) {
    if (typeof character.name !== 'string' || !character.name.trim()) return res.status(400).json({ message: 'character.name is required.' });
    const sanitized = sanitizeCharacterInput(character);
    if (!sanitized.ok) return res.status(400).json({ message: sanitized.message });
    // Keep the server-owned photo reference across edits.
    const existing = (book.characterConfig ?? {}) as any;
    nextConfig = { ...sanitized.value, ...(existing.photoKey ? { photoKey: existing.photoKey, photoMimeType: existing.photoMimeType } : {}) };
  }

  const updated = await prisma.bookProject.update({
    where: { id: book.id },
    data: {
      characterConfig: nextConfig,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
    },
  });
  res.json({ data: updated });
});

// ============================================================
// CHARACTER PHOTO (optional) — upload / view / remove
// ============================================================
router.post('/:id/character-photo', authenticate, handlePhotoUpload, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (!canChangeCharacterPhoto(book)) {
    return res.status(400).json({ message: 'The photo can only be changed before the character is approved.' });
  }
  if (!req.file) return res.status(400).json({ message: 'No photo was selected.' });

  let normalized: Awaited<ReturnType<typeof normalizeCharacterPhoto>>;
  try {
    normalized = await normalizeCharacterPhoto(req.file.buffer);
  } catch {
    return res.status(400).json({ message: 'This file could not be read as an image.' });
  }

  const config = (book.characterConfig ?? {}) as any;
  const key = `books/${book.id}/character-photo-${Date.now().toString(36)}.jpg`;
  await storeBookAsset(key, normalized.buffer, normalized.mimeType);
  const updated = await prisma.bookProject.update({
    where: { id: book.id },
    data: { characterConfig: { ...config, photoKey: key, photoMimeType: normalized.mimeType } as any },
  });
  if (config.photoKey && config.photoKey !== key) await deleteBookAsset(config.photoKey).catch(() => {});
  res.status(201).json({ data: updated });
});

router.get('/:id/character-photo', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  const config = (book.characterConfig ?? {}) as any;
  if (!config.photoKey) return res.status(404).json({ message: 'No photo uploaded.' });
  try {
    const buffer = await readBookAsset(config.photoKey);
    res.setHeader('Content-Type', config.photoMimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Photo not found.' });
  }
});

router.delete('/:id/character-photo', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (!canChangeCharacterPhoto(book)) {
    return res.status(400).json({ message: 'The photo can only be changed before the character is approved.' });
  }
  const { photoKey, photoMimeType, ...rest } = (book.characterConfig ?? {}) as any;
  void photoMimeType;
  const updated = await prisma.bookProject.update({ where: { id: book.id }, data: { characterConfig: rest } });
  if (photoKey) await deleteBookAsset(photoKey).catch(() => {});
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

  // FAILED with a Character Bible is a paid book whose final generation
  // failed — it resumes via final-generation/start, never back into the
  // pre-payment preview stage.
  // CHARACTER_PREVIEW_READY is the "Regenerate" button on an unapproved
  // portrait (e.g. after the parent adds or changes the photo).
  const eligibleFromStates: string[] = book.characterBible ? ['STORY_PLAN_READY'] : ['STORY_PLAN_READY', 'CHARACTER_PREVIEW_READY', 'FAILED'];
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
    appearancePromptLine(character),
    character.photoKey ? photoReferencePromptLine() : '',
    'Soft watercolor textures, consistent body proportions, delicate clean linework, no readable text or letters anywhere in the image, reserve the upper-left 30% free of detail.',
  ].filter(Boolean).join(' ');

  const referenceImages = await loadReferenceImage(character.photoKey, character.photoMimeType);
  const started = new Date();
  const result = await generateBookImage({ prompt, size: '1024x1024', quality: 'low', referenceImages });
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

  try {
    const buffer = await readBookAsset(config.previewImageKey);
    res.setHeader('Content-Type', config.previewImageMimeType || 'image/png');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Preview image not found.' });
  }
});

router.get('/:id/page/:pageNumber/image', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: true } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  const pageNumber = Number(req.params.pageNumber);
  const page = book.pages.find((entry) => entry.pageNumber === pageNumber);
  const scene = page?.sceneSpec as any;
  if (!page || !scene?.imageKey) return res.status(404).json({ message: 'Page illustration not found.' });

  try {
    const buffer = await readBookAsset(scene.imageKey);
    res.setHeader('Content-Type', scene.imageMimeType || 'image/png');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Page illustration not available.' });
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
  const characterBible = {
    name: character.name,
    age: character.age,
    traits: character.traits,
    favoriteThing: character.favoriteThing,
    appearance: character.appearance,
    extraCharacters: character.extraCharacters,
    previewImageKey: character.previewImageKey,
    previewImageMimeType: character.previewImageMimeType,
    // When the parent gave a photo, final pages use the approved portrait
    // as a reference image so the child looks the same on every page.
    useReferencePortrait: !!character.photoKey,
  };
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
// BOOK PREVIEW CONFIRMATION — the buyer has seen the full preview (cover,
// approved character, every page's text) and wants to continue to payment.
// Checkout and the dev payment simulation both refuse a book without it.
// ============================================================
router.post('/:id/preview-confirm', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });
  if (book.status !== 'CHARACTER_APPROVED' && book.status !== 'PAYMENT_PENDING') {
    return res.status(400).json({ message: `The preview cannot be confirmed from status ${book.status}.` });
  }
  const updated = book.previewConfirmedAt
    ? book
    : await prisma.bookProject.update({ where: { id: book.id }, data: { previewConfirmedAt: new Date() } });
  res.json({ data: updated });
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
  if (!book.previewConfirmedAt) return res.status(400).json({ message: 'Please review the book preview before paying.' });
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
  if (result.handled) await startFinalGeneration(book.id);
  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id } });
  res.json({ data: fresh, handled: result.handled });
});

// ============================================================
// FINAL GENERATION — start/resume. Claims the book and runs generation in
// the background (bookFinalGenerationService); the client polls
// /final-generation/status. Payment completion starts it automatically, so
// this route is only the manual Retry / resume path.
// ============================================================
router.post('/:id/final-generation/start', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const outcome = await startFinalGeneration(book.id);
  if (outcome === 'NOT_ELIGIBLE' || outcome === 'NOT_FOUND') {
    return res.status(400).json({ message: `Final generation cannot start from status ${book.status}.` });
  }

  const fresh = await prisma.bookProject.findUnique({ where: { id: book.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  res.status(202).json({ data: fresh, started: outcome === 'STARTED', mocked: isImageGenerationMocked() });
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
    appearancePromptLine(characterBible),
    extraCharactersPromptLine(characterBible),
    planPage ? `Original scene: ${planPage.sceneDescription}.` : '',
    typeof note === 'string' && note.trim() ? `Requested change: ${note.trim()}.` : '',
    'No readable text or letters anywhere in the image.',
  ].filter(Boolean).join(' ');
  const revisionReferences = characterBible?.useReferencePortrait
    ? await loadReferenceImage(characterBible.previewImageKey, characterBible.previewImageMimeType)
    : [];

  const previousAttempts = await prisma.bookGenerationEvent.count({
    where: { bookProjectId: book.id, operationType: 'REVISION', pageNumber, revisionVersion: 1 },
  });
  const logicalOperationKey = buildLogicalOperationKey({ bookProjectId: book.id, operationType: 'REVISION', pageNumber, revisionVersion: 1 });

  const started = new Date();
  const result = await generateBookImage({ prompt, size: '1024x1024', quality: 'medium', referenceImages: revisionReferences });
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
    const narrationProvider = getBookNarrationProvider();
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

type NarratedPage = { pageNumber: number; storyText: string | null };

// Synthesizes one page's narration, stores it, and creates/updates its
// artifact row at the given revisionVersion. Throws on provider/storage
// failure — callers decide how to surface that.
async function narrateAndSavePage(
  book: { id: string; language: string },
  page: NarratedPage,
  revisionVersion: number,
  narrationProvider: ReturnType<typeof getBookNarrationProvider>
) {
  const result = await narrationProvider.generatePageNarration({
    bookProjectId: book.id,
    pageNumber: page.pageNumber,
    revisionVersion,
    language: narrationLanguageForBook(book.language),
    text: page.storyText ?? '',
  });
  await storeBookAsset(result.storageKey, result.buffer, result.mimeType);
  return prisma.bookNarrationArtifact.upsert({
    where: { bookProjectId_pageNumber_revisionVersion: { bookProjectId: book.id, pageNumber: page.pageNumber, revisionVersion } },
    update: { status: 'READY', language: result.language, mimeType: result.mimeType, artifactKey: result.storageKey, attemptCount: { increment: 1 } },
    create: {
      bookProjectId: book.id,
      pageNumber: page.pageNumber,
      revisionVersion,
      status: 'READY',
      language: result.language,
      mimeType: result.mimeType,
      artifactKey: result.storageKey,
      attemptCount: 1,
    },
  });
}

function narrationFailureResponse(res: Response, err: unknown, pageNumber: number) {
  if (err instanceof AzureSpeechError) return res.status(err.status).json({ message: err.message });
  return res.status(502).json({ message: `Narration for page ${pageNumber} could not be generated.` });
}

function narrationArtifactDto(artifact: { id: string; pageNumber: number; revisionVersion: number; status: string; language: string; mimeType: string | null }) {
  return {
    id: artifact.id,
    pageNumber: artifact.pageNumber,
    revisionVersion: artifact.revisionVersion,
    status: artifact.status,
    language: artifact.language,
    mimeType: artifact.mimeType,
  };
}

// Narrates only the pages that don't have a READY narration yet, so a retry
// after a partial failure never re-synthesizes (and re-bills) finished
// pages. Full regeneration is audio/revision's job, below.
router.post('/:id/audio/generate', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  if (!canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status })) {
    return res.status(400).json({ message: 'Audio narration is only available for a paid, audio-enabled book.' });
  }

  const narrationProvider = getBookNarrationProvider();
  const ready = await prisma.bookNarrationArtifact.findMany({ where: { bookProjectId: book.id, status: 'READY', artifactKey: { not: null } } });
  const readyPages = new Set(ready.map((artifact) => artifact.pageNumber));
  const generated = [] as Awaited<ReturnType<typeof narrateAndSavePage>>[];
  for (const page of book.pages) {
    if (readyPages.has(page.pageNumber)) continue;
    try {
      generated.push(await narrateAndSavePage(book, page, 0, narrationProvider));
    } catch (err) {
      // Pages narrated before the failure are saved; re-running this
      // endpoint continues from the first missing page.
      return narrationFailureResponse(res, err, page.pageNumber);
    }
  }

  res.status(201).json({
    data: {
      audioAddOnPurchased: true,
      audioPriceGel: book.audioPriceGel,
      totalPriceGel: book.totalPriceGel,
      eligible: true,
      skippedPages: readyPages.size,
      artifacts: generated.map(narrationArtifactDto),
    },
  });
});

// Explicit regeneration of already-narrated audio (this re-bills Azure):
// one page when `pageNumber` is given, otherwise the whole book. Each page is
// re-synthesized at the revisionVersion it is currently served from.
router.post('/:id/audio/revision', authenticate, async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, include: { pages: { orderBy: { pageNumber: 'asc' } } } });
  if (!isOwner(book, req.user!.id)) return res.status(404).json({ message: 'Book not found.' });

  const hasPageNumber = req.body?.pageNumber !== undefined && req.body?.pageNumber !== null;
  const pageNumber = Number(req.body?.pageNumber);
  if (hasPageNumber && (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > book.pageCount)) {
    return res.status(400).json({ message: 'Invalid pageNumber for narration revision.' });
  }
  if (!canGenerateNarration({ audioAddOnPurchased: !!book.audioAddOnPurchased, paymentStatus: book.status })) {
    return res.status(400).json({ message: 'Audio narration revision is available only after payment.' });
  }

  const pages = hasPageNumber ? book.pages.filter((page) => page.pageNumber === pageNumber) : book.pages;
  if (pages.length === 0) return res.status(404).json({ message: 'Page not found.' });

  const narrationProvider = getBookNarrationProvider();
  const existing = await prisma.bookNarrationArtifact.findMany({ where: { bookProjectId: book.id, status: 'READY' }, orderBy: { revisionVersion: 'desc' } });
  const regenerated = [] as Awaited<ReturnType<typeof narrateAndSavePage>>[];
  for (const page of pages) {
    const servedVersion = existing.find((artifact) => artifact.pageNumber === page.pageNumber)?.revisionVersion ?? 0;
    try {
      regenerated.push(await narrateAndSavePage(book, page, servedVersion, narrationProvider));
    } catch (err) {
      return narrationFailureResponse(res, err, page.pageNumber);
    }
  }

  res.status(201).json({ data: { artifacts: regenerated.map(narrationArtifactDto) } });
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

  try {
    const buffer = await readBookAsset(artifact.artifactKey);
    res.setHeader('Content-Type', artifact.mimeType || 'audio/wav');
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'Narration file not available.' });
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
      if (imageKey) {
        try {
          imageBuffer = await readBookAsset(imageKey);
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

  try {
    const buffer = await readBookAsset(book.finalPdfBlobRef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${book.title.replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf"`);
    res.send(buffer);
  } catch {
    res.status(404).json({ message: 'PDF file not available.' });
  }
});

export default router;
