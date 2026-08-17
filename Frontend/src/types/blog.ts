interface BlogAuthor {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  avatarUrl: string | null;
}

export interface BlogPost {
  id: string;
  // Georgian (primary) fields — always set.
  title: string;
  description: string;
  content: string;
  // English twins — optional; public pages fall back to the Georgian fields
  // above when these are null (see pages/blog).
  titleEn: string | null;
  descriptionEn: string | null;
  contentEn: string | null;
  category: string;
  imageUrl: string | null;
  author: BlogAuthor;
  published: boolean;
  // URL-friendly identifier for /blog/[slug] — every post has one
  // (auto-generated at creation, backfilled for older rows), so links
  // should always prefer this over the raw id.
  slug: string;
  createdAt: string;
  updatedAt: string;
  // Written by the 3x/week cron agent (blogAgentService.ts) rather than a
  // human admin — see the "🤖 AI Generated" badge in admin/blog.tsx. Admins
  // can freely edit/unpublish/delete these like any other post; this is
  // purely informational.
  generatedByAgent?: boolean;
}

interface BlogCommentAuthor {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  avatarUrl: string | null;
}

export interface BlogComment {
  id: string;
  postId: string;
  author: BlogCommentAuthor;
  content: string;
  parentId: string | null;
  createdAt: string;
}
