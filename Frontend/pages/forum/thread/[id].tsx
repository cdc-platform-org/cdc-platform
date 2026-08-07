import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthModal } from '../../../src/context/AuthModalContext';
import VerifiedGraduateBadge from '../../../src/components/community/VerifiedGraduateBadge';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SocialShareButtons from '../../../src/components/shared/SocialShareButtons';
import { ForumThread, ForumComment } from '../../../src/types/forum';
import {
  getThreadById,
  getComments,
  createComment,
  likeThread,
  unlikeThread,
  likeComment,
  unlikeComment,
} from '../../../src/services/forumService';

const COMMENTS_PAGE_SIZE = 20;

function ThreadDetailContent() {
  const { t } = useTranslation('forum');
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const SIGN_IN_TO_ENGAGE = { ka: 'გთხოვთ გაიაროთ ავტორიზაცია ფორუმზე დასაწერად', en: 'Please sign in to post on the forum' };
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (typeof id !== 'string') return;
    try {
      const data = await getThreadById(id);
      setThread(data);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    if (typeof id !== 'string') return;
    try {
      const result = await getComments(id, { page: commentsPage, pageSize: COMMENTS_PAGE_SIZE });
      setComments(result.items);
      setTotalComments(result.totalCount);
    } catch {
      setError(t('loadCommentsError'));
    }
  }, [id, commentsPage, t]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadThread(), loadComments()]).finally(() => setLoading(false));
  }, [loadThread, loadComments]);

  const handleThreadLikeToggle = async () => {
    if (!thread) return;
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_ENGAGE });
      return;
    }
    const updated = thread.isLikedByCurrentUser
      ? await unlikeThread(thread.id)
      : await likeThread(thread.id);
    setThread(updated);
  };

  const handleCommentLikeToggle = async (comment: ForumComment) => {
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_ENGAGE });
      return;
    }
    const updated = comment.isLikedByCurrentUser
      ? await unlikeComment(comment.id)
      : await likeComment(comment.id);
    setComments((prev) => prev.map((c) => (c.id === comment.id ? updated : c)));
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (typeof id !== 'string') return;
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_ENGAGE });
      return;
    }
    setCommentError(null);
    if (newComment.trim().length < 2) {
      setCommentError(t('commentTooShort'));
      return;
    }
    setSubmittingComment(true);
    try {
      const created = await createComment(id, newComment.trim());
      setComments((prev) => [created, ...prev]);
      setTotalComments((prev) => prev + 1);
      setNewComment('');
      setThread((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
    } catch {
      setCommentError(t('postCommentError'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const totalPages = Math.ceil(totalComments / COMMENTS_PAGE_SIZE);

  if (loading) {
    return <p className="text-center text-sm text-gray-400 py-10">{t('loading')}</p>;
  }

  if (notFound || !thread) {
    return <p className="text-center text-sm text-gray-500 py-10">{t('threadNotFound')}</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/forum" className="text-sm text-gray-500 hover:text-gray-700">
          {t('backToCategories')}
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {thread.isPinned && (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                📌 {t('pinned')}
              </span>
            )}
            {thread.isLocked && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                🔒 {t('locked')}
              </span>
            )}
            {thread.author.role !== 'Student' && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {thread.author.role}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{thread.title}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {thread.author.name} · {new Date(thread.createdAt).toLocaleDateString()}
            </span>
            {thread.author.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
          </p>
          <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{thread.content}</p>
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleThreadLikeToggle}
              className={`text-sm font-medium ${
                thread.isLikedByCurrentUser ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {thread.isLikedByCurrentUser ? '♥' : '♡'} {thread.likeCount}
            </button>
            <span className="text-sm text-gray-400">{t('repliesCount', { count: thread.commentCount })}</span>
            <SocialShareButtons title={thread.title} lang={lang} className="ml-auto" />
          </div>
        </div>

        <div className="mt-6">
          {thread.isLocked ? (
            <p className="text-sm text-gray-500 bg-gray-100 rounded-lg px-4 py-3">{t('threadLockedNotice')}</p>
          ) : (
            <form onSubmit={handleSubmitComment} className="bg-white rounded-xl border border-gray-200 p-4">
              {commentError && (
                <p className="text-xs text-red-600 mb-2">{commentError}</p>
              )}
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={t('replyPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submittingComment ? t('postingReply') : t('reply')}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {comments.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noReplies')}</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{comment.author.name}</p>
                  {comment.author.role !== 'Student' && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {comment.author.role}
                    </span>
                  )}
                  {comment.author.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
                  <span className="text-xs text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{comment.content}</p>
                <button
                  onClick={() => handleCommentLikeToggle(comment)}
                  className={`text-xs font-medium mt-3 ${
                    comment.isLikedByCurrentUser ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {comment.isLikedByCurrentUser ? '♥' : '♡'} {comment.likeCount}
                </button>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setCommentsPage((p) => Math.max(1, p - 1))}
              disabled={commentsPage === 1}
              className="text-sm font-medium text-gray-600 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {commentsPage} of {totalPages}
            </span>
            <button
              onClick={() => setCommentsPage((p) => Math.min(totalPages, p + 1))}
              disabled={commentsPage === totalPages}
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

export default function ThreadDetailPage() {
  return (
    <>
      <SiteHeader />
      <ThreadDetailContent />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['forum'])) },
});