import { prisma } from '../lib/prisma';
import { generateBlogDraft, generateCoverImage, isAiAgentConfigured, AiAgentError } from './aiAgentService';
import { logAiGeneration } from './aiGenerationLogService';
import { createUniqueBlogSlug } from './blogSlugService';
import { getAiAutomationSettings } from './aiAutomationSettingsService';

// Broadcasts to every admin-team member (SUPER_ADMIN/MANAGER/MODERATOR —
// same "adminRole set" test as adminPanel.ts's /team) rather than one fixed
// recipient, since any of them might be the one who checks /admin/blog.
async function notifyAdmins(title: string, message: string): Promise<void> {
  const admins = await prisma.user.findMany({ where: { adminRole: { not: null } }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, title, message, type: 'AI_AGENT' })),
  });
}

export class BlogAgentError extends Error {
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'BlogAgentError';
    this.status = status;
  }
}

// The autonomous cron draft has no human actor to attribute BlogPost's
// required `authorId` FK to — attribute it to the earliest-created
// SUPER_ADMIN account instead (a stable, always-present choice on any
// deployment that's actually running this cron, since a SUPER_ADMIN had to
// exist to configure CRON_SECRET/GEMINI_API_KEY in the first place).
async function resolveAgentAuthorId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { adminRole: 'SUPER_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!admin) {
    throw new BlogAgentError('No SUPER_ADMIN account exists to attribute the AI-drafted post to.');
  }
  return admin.id;
}

// Generates a full blog draft (+ best-effort cover image) and saves it as a
// BlogPost for admin review in /admin/blog — published immediately only
// when an admin has opted into AiAutomationSettings.blogAutoPublish (off by
// default, the only behavior before this setting existed: every draft
// lands unpublished). Used by POST /api/cron/generate-blog-draft.
export async function generateAndSaveBlogDraft(topic?: string) {
  if (!isAiAgentConfigured()) {
    throw new BlogAgentError('AI agent is not configured yet (GEMINI_API_KEY).');
  }

  try {
    const authorId = await resolveAgentAuthorId();
    const draft = await generateBlogDraft(topic);
    const imageUrl = await generateCoverImage(draft.imageConcept);
    const slug = await createUniqueBlogSlug(draft.title);
    const { blogAutoPublish } = await getAiAutomationSettings();

    const post = await prisma.blogPost.create({
      data: {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        category: draft.category,
        titleEn: draft.titleEn,
        descriptionEn: draft.descriptionEn,
        contentEn: draft.contentEn,
        imageUrl: imageUrl ?? null,
        authorId,
        slug,
        published: blogAutoPublish,
        generatedByAgent: true,
        agentPromptContext: topic ?? null,
      },
    });

    notifyAdmins(
      blogAutoPublish ? '🤖 AI-ს მიერ დაწერილი სტატია გამოქვეყნდა' : '🤖 AI-ს მიერ დაწერილი სტატია მზადაა განსახილველად',
      `„${post.title}" ${blogAutoPublish ? 'ავტომატურად გამოქვეყნდა.' : 'ელოდება თქვენს განხილვას /admin/blog-ზე.'}`
    ).catch(() => {});

    logAiGeneration({
      module: 'blog_cron',
      status: 'success',
      inputContext: { topic: topic ?? null, imageGenerated: !!imageUrl, published: blogAutoPublish },
      outputSummary: draft.title,
    }).catch(() => {});

    return { postId: post.id, title: post.title, slug: post.slug, imageGenerated: !!imageUrl, published: blogAutoPublish };
  } catch (err) {
    logAiGeneration({
      module: 'blog_cron',
      status: 'failed',
      inputContext: { topic: topic ?? null },
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    if (err instanceof AiAgentError || err instanceof BlogAgentError) throw err;
    throw new BlogAgentError(err instanceof Error ? err.message : 'Failed to generate blog draft.');
  }
}
