import crypto from 'crypto';

// Best-effort ASCII slug from a title — works cleanly for Latin-script
// titles. A Georgian-script title (most posts, per blog_posts' comment on
// title being the primary Georgian field) has no Latin/numeric characters
// to keep, so the result is empty; callers should fall back to
// randomSlugSuffix() in that case rather than storing an empty slug.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function randomSlugSuffix(): string {
  return crypto.randomBytes(4).toString('hex');
}
