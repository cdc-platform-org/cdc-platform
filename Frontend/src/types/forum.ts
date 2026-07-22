interface Author {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
}

// ============================================================
// CATEGORIES
// ============================================================
export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  slug: string;        // URL-friendly identifier, e.g. "technical-help"
  threadCount: number;  // denormalized count, maintained server-side for cheap listing
  createdAt: string;
}

// ============================================================
// THREADS
// ============================================================
export interface ForumThread {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  author: Author;
  likeCount: number;
  commentCount: number;   // denormalized, avoids fetching all comments just to show a count
  isLikedByCurrentUser: boolean; // server tells us this per-request, since likes are per-user
  isPinned: boolean;      // moderator action — pinned threads sort first
  isLocked: boolean;      // moderator action — locked threads reject new comments
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// COMMENTS
// ============================================================
export interface ForumComment {
  id: string;
  threadId: string;
  content: string;
  author: Author;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
}

// ============================================================
// PAGINATION
// ============================================================
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}