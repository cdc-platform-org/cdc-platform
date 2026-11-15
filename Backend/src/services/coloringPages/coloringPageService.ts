import { hasIncludedAiToolAccess } from '../payments/aiToolSubscriptionService';
/**
 * Generates one coloring page end to end: limits -> topic safety -> reserve
 * credit -> gpt-image-2 -> image safety -> store PNG (or refund).
 * Exports: generateColoringPage, ColoringGenerationError, listColoringPages,
 * readColoringPageImage, deleteColoringPage.
 *
 * Safety rules live in coloringSafety.ts, prices in coloringPacks.ts, credit
 * bookkeeping in coloringCreditService.ts. Files reuse the children's-book
 * storage adapter (private Azure Blob in prod, local disk in dev).
 */
import { prisma } from '../../lib/prisma';
import { generateImage, isAzureImageConfigured } from '../ai/azureImageService';
import { storeBookAsset, readBookAsset, deleteBookAsset } from '../childrensBook/bookStorageService';
import { isContentSafetyConfigured } from './contentSafety';
import { moderateTopic, moderateImage, BlockReason } from './coloringSafety';
import { reserveCredit, refundCredit, CreditSource } from './coloringCreditService';
import { COLORING_LIMITS } from './coloringPacks';

export type ColoringErrorCode = 'NOT_CONFIGURED' | 'INVALID_TOPIC' | 'RATE_LIMITED' | 'BUSY' | 'NO_CREDITS' | 'BLOCKED' | 'FAILED';

export class ColoringGenerationError extends Error {
  constructor(public code: ColoringErrorCode, message: string, public reason?: BlockReason) {
    super(message);
    this.name = 'ColoringGenerationError';
  }
}

// gpt-image-2 rates (USD / 1M tokens), same as productAgent/ai.ts.
const IMAGE_OUT_USD_PER_M = 30;
const IMAGE_IN_USD_PER_M = 5;

function buildImagePrompt(subject: string): string {
  return (
    `A children's coloring book page: ${subject}. ` +
    'Clean black outline line art on a pure white background, bold smooth closed lines of even thickness, ' +
    'large simple shapes that are easy for a child to color, no shading, no gray tones, no color, no filled black areas, no hatching. ' +
    'Friendly, cheerful and age-appropriate for young children. Whole subject fits inside the page with a white margin. ' +
    'Original design: no copyrighted characters, brands or logos. No text, letters, numbers, signature or watermark.'
  );
}

export async function generateColoringPage(userId: string, rawTopic: string) {
  if (!isAzureImageConfigured() || !isContentSafetyConfigured()) {
    throw new ColoringGenerationError('NOT_CONFIGURED', 'Coloring pages are temporarily unavailable.');
  }
  const topic = rawTopic.replace(/\s+/g, ' ').trim();
  if (topic.length < 2 || topic.length > COLORING_LIMITS.topicMaxLength) {
    throw new ColoringGenerationError('INVALID_TOPIC', `Topic must be 2-${COLORING_LIMITS.topicMaxLength} characters.`);
  }

  // Limits are counted from rows (blocked attempts included), so abuse of
  // the paid image call is capped even when every attempt gets refunded.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recent, inFlight] = await Promise.all([
    prisma.coloringPage.count({ where: { userId, createdAt: { gte: hourAgo } } }),
    prisma.coloringPage.count({ where: { userId, status: 'GENERATING', createdAt: { gte: new Date(Date.now() - COLORING_LIMITS.staleGeneratingMs) } } }),
  ]);
  if (recent >= COLORING_LIMITS.pagesPerHour) throw new ColoringGenerationError('RATE_LIMITED', 'Hourly limit reached. Please try again later.');
  if (inFlight > 0) throw new ColoringGenerationError('BUSY', 'Another page is still being drawn.');

  const decision = await moderateTopic(topic);
  if (!decision.allowed) {
    await prisma.coloringPage.create({
      data: { userId, topic, status: 'BLOCKED', paidWith: 'NONE', blockedReason: `TOPIC_${decision.reason}`, costUsd: decision.textCostUsd },
    });
    throw new ColoringGenerationError('BLOCKED', 'This topic is not allowed.', decision.reason);
  }

  const includedAccess = await hasIncludedAiToolAccess(userId, 'coloring-pages');
  let source: CreditSource;
  let page: { id: string };
  try {
    ({ source, page } = await prisma.$transaction(async (tx) => {
      const s: CreditSource = includedAccess ? 'SUBSCRIPTION' : await reserveCredit(tx, userId);
      const p = await tx.coloringPage.create({
        data: { userId, topic, subject: decision.subject, status: 'GENERATING', paidWith: s, costUsd: decision.textCostUsd },
        select: { id: true },
      });
      return { source: s, page: p };
    }));
  } catch (err) {
    if ((err as Error).name === 'NoColoringCreditsError') throw new ColoringGenerationError('NO_CREDITS', 'No credits left.');
    throw err;
  }

  let costUsd = decision.textCostUsd;
  const finish = async (status: 'BLOCKED' | 'FAILED', reason: string) => {
    await refundCredit(userId, source);
    await prisma.coloringPage.update({ where: { id: page.id }, data: { status, blockedReason: reason, costUsd } });
  };

  try {
    const result = await generateImage({ prompt: buildImagePrompt(decision.subject), size: '1024x1536', quality: 'medium', outputFormat: 'png' });
    if (!result.success) {
      // Azure's own content filter refusing counts as a block, not an outage.
      if (result.errorClassification === 'CONTENT_FILTER') {
        await finish('BLOCKED', 'AZURE_FILTER');
        throw new ColoringGenerationError('BLOCKED', 'This topic is not allowed.', 'OTHER');
      }
      console.error(`[coloring] image generation failed: ${result.errorClassification} ${result.httpStatus ?? ''}`);
      await finish('FAILED', result.errorClassification);
      throw new ColoringGenerationError('FAILED', 'Drawing failed. Your credit was not used.');
    }
    const out = result.usage?.outputTokens ?? 1600;
    costUsd += (out * IMAGE_OUT_USD_PER_M + (result.usage?.inputTokens ?? 150) * IMAGE_IN_USD_PER_M) / 1_000_000;

    const imageCheck = await moderateImage(result.buffer);
    if (!imageCheck.allowed) {
      await finish('BLOCKED', `IMAGE_${imageCheck.reason}`);
      throw new ColoringGenerationError('BLOCKED', 'The drawing did not pass the safety check. Your credit was not used.', imageCheck.reason ?? 'OTHER');
    }

    const blobName = `coloring-pages/${userId}/${page.id}.png`;
    await storeBookAsset(blobName, result.buffer, 'image/png');
    return prisma.coloringPage.update({
      where: { id: page.id },
      data: { status: 'READY', blobName, costUsd },
      select: { id: true, topic: true, status: true, createdAt: true },
    });
  } catch (err) {
    if (err instanceof ColoringGenerationError) throw err;
    console.error('[coloring] generation crashed:', (err as Error).message);
    await finish('FAILED', 'EXCEPTION').catch(() => {});
    throw new ColoringGenerationError('FAILED', 'Drawing failed. Your credit was not used.');
  }
}

export function listColoringPages(userId: string) {
  return prisma.coloringPage.findMany({
    where: { userId, status: 'READY' },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, topic: true, status: true, createdAt: true },
  });
}

export async function readColoringPageImage(userId: string, pageId: string): Promise<Buffer | null> {
  const page = await prisma.coloringPage.findFirst({ where: { id: pageId, userId, status: 'READY' }, select: { blobName: true } });
  if (!page?.blobName) return null;
  return readBookAsset(page.blobName);
}

export async function deleteColoringPage(userId: string, pageId: string): Promise<boolean> {
  const page = await prisma.coloringPage.findFirst({ where: { id: pageId, userId }, select: { id: true, blobName: true } });
  if (!page) return false;
  if (page.blobName) await deleteBookAsset(page.blobName).catch(() => {});
  await prisma.coloringPage.delete({ where: { id: page.id } });
  return true;
}
