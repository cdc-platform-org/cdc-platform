import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ThreadListItem from '../../../src/components/forum/ThreadListItem';
import { useAuth } from '../../../src/context/AuthContext';
import { ForumCategory, ForumThread } from '../../../src/types/forum';
import {
  getCategories,
  getThreads,
  pinThread,
  unpinThread,
  lockThread,
  unlockThread,
} from '../../../src/services/forumService';

const PAGE_SIZE = 20;

function ThreadListingContent() {
  const router = useRouter();
  const { categorySlug } = router.query;
  const { user } = useAuth();
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canModerate = user?.role === 'Mentor' || user?.role === 'SuperAdmin';

  const loadThreads = useCallback(async () => {
    if (typeof categorySlug !== 'string') return;
    setLoading(true);
    setError(null);
    try {
      const categories = await getCategories();
      const matchedCategory = categories.find((c) => c.slug === categorySlug);
      if (!matchedCategory) {
        setNotFound(true);
        return;
      }
      setCategory(matchedCategory);

      const result = await getThreads({
        categoryId: matchedCategory.id,
        page,
        pageSize: PAGE_SIZE,
      });

      const sorted = [...result.items].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });

      setThreads(sorted);
      setTotalCount(result.totalCount);
    } catch (error) {
      setError('Unable to load threads. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [categorySlug, page]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const applyThreadUpdate = (updated: ForumThread) => {
    setThreads((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t));
      return [...next].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    });
  };

  const handlePin = async (threadId: string) => applyThreadUpdate(await pinThread(threadId));
  const handleUnpin = async (threadId: string) => applyThreadUpdate(await unpinThread(threadId));
  const handleLock = async (threadId: string) => applyThreadUpdate(await lockThread(threadId));
  const handleUnlock = async (threadId: string) => applyThreadUpdate(await unlockThread(threadId));

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && !category) {
    return <p className="text-center text-sm text-gray-400 py-10">Loading…</p>;
  }

  if (notFound) {
    return <p className="text-center text-sm text-gray-500 py-10">This category doesn't exist.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Link href="/forum" className="text-sm text-gray-500 hover:text-gray-700">
            ← All categories
          </Link>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{category?.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{category?.description}</p>
          </div>
          <Link
            href={`/forum/${categorySlug}/new`}
            className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
          >
            New Thread
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {threads.length === 0 ? (
          <p className="text-sm text-gray-500">No threads yet — be the first to post.</p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                canModerate={canModerate}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onLock={handleLock}
                onUnlock={handleUnlock}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm font-medium text-gray-600 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm font-medium text-gray-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThreadListingPage() {
  return (
    <ProtectedRoute>
      <ThreadListingContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});