import { prisma } from '../lib/prisma';
import { generateBlogDraft, generateCoverImage, isAiAgentConfigured, AiAgentError } from './aiAgentService';
import { logAiGeneration } from './aiGenerationLogService';
import { createUniqueBlogSlug } from './blogSlugService';

export class BlogAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlogAgentError';
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

// Generates a full blog draft (+ best-effort cover image) and saves it as
// an UNPUBLISHED BlogPost for a human admin to review in /admin/blog —
// never auto-publishes. Used by POST /api/cron/generate-blog-draft.
export async function generateAndSaveBlogDraft(topic?: string) {
  if (!isAiAgentConfigured()) {
    throw new BlogAgentError('AI agent is not configured yet (GEMINI_API_KEY).');
  }

  try {
    const authorId = await resolveAgentAuthorId();
    const draft = await generateBlogDraft(topic);
    const imageUrl = await generateCoverImage(draft.imageConcept);
    const slug = await createUniqueBlogSlug(draft.title);

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
        published: false,
        generatedByAgent: true,
        agentPromptContext: topic ?? null,
      },
    });

    logAiGeneration({
      module: 'blog_cron',
      status: 'success',
      inputContext: { topic: topic ?? null, imageGenerated: !!imageUrl },
      outputSummary: draft.title,
    }).catch(() => {});

    return { postId: post.id, title: post.title, slug: post.slug, imageGenerated: !!imageUrl };
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
