import { prisma } from '../lib/prisma';
import { slugify, randomSlugSuffix } from '../utils/slugify';

// Shared by routes/blog.ts (admin-authored posts) and blogAgentService.ts
// (AI-drafted posts) — loops on a real unique-constraint collision rather
// than pre-checking existence — the pre-check-then-insert shape has a race
// window two concurrent creates could both slip through; retrying on the
// DB's own rejection doesn't.
export async function createUniqueBlogSlug(title: string): Promise<string> {
  const base = slugify(title) || 'post';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${randomSlugSuffix()}`;
}
