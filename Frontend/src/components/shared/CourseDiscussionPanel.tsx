import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { CourseDiscussionPost } from '../../types/lms';
import { getCourseDiscussion, createCourseDiscussionPost, deleteCourseDiscussionPost } from '../../services/courseService';
import { useAuth } from '../../context/AuthContext';
import { onImageErrorFallback } from '../../utils/imageFallback';

const dict = {
  ka: {
    placeholder: 'დასვი კითხვა ან გააზიარე კოდის ბმული…',
    post: 'გამოქვეყნება',
    posting: 'იგზავნება…',
    reply: 'პასუხი',
    replyPlaceholder: 'დაწერე პასუხი…',
    cancel: 'გაუქმება',
    empty: 'ჯერ არცერთი კითხვა არ დასმულა — იყავი პირველი!',
    loading: 'იტვირთება…',
    delete: 'წაშლა',
  },
  en: {
    placeholder: 'Ask a question or share a code link…',
    post: 'Post',
    posting: 'Posting…',
    reply: 'Reply',
    replyPlaceholder: 'Write a reply…',
    cancel: 'Cancel',
    empty: 'No questions yet — be the first to ask!',
    loading: 'Loading…',
    delete: 'Delete',
  },
};

function timeAgo(iso: string, lang: 'ka' | 'en'): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return lang === 'ka' ? 'ახლახან' : 'just now';
  if (mins < 60) return lang === 'ka' ? `${mins} წთ წინ` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'ka' ? `${hours} სთ წინ` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'ka' ? `${days} დღის წინ` : `${days}d ago`;
}

function PostRow({
  post,
  lang,
  canModerate,
  onDeleted,
}: {
  post: CourseDiscussionPost;
  lang: 'ka' | 'en';
  canModerate: boolean;
  onDeleted: (id: string) => void;
}) {
  const t = dict[lang];
  const handleDelete = async () => {
    if (!window.confirm(lang === 'ka' ? 'წავშალო ეს პოსტი?' : 'Delete this post?')) return;
    await deleteCourseDiscussionPost(post.id);
    onDeleted(post.id);
  };

  return (
    <div className="flex items-start gap-3">
      {post.author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.author.avatarUrl}
          alt={post.author.name}
          onError={onImageErrorFallback}
          className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
          {post.author.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{post.author.name}</span>
          <span className="text-[11px] text-slate-500">{timeAgo(post.createdAt, lang)}</span>
        </div>
        <p className="text-sm text-slate-300 whitespace-pre-wrap break-words mt-0.5">{post.content}</p>
      </div>
      {canModerate && (
        <button
          type="button"
          onClick={handleDelete}
          title={t.delete}
          className="shrink-0 text-slate-600 hover:text-red-400 bg-transparent border-none cursor-pointer p-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function CourseDiscussionPanel({ courseId, lang }: { courseId: string; lang: 'ka' | 'en' }) {
  const t = dict[lang];
  const { user } = useAuth();
  const canModerate = user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'MANAGER';

  const [posts, setPosts] = useState<CourseDiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await getCourseDiscussion(courseId));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await createCourseDiscussionPost(courseId, { content: newContent.trim() });
      setNewContent('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? (lang === 'ka' ? 'გამოქვეყნება ვერ მოხერხდა.' : 'Unable to post. Please try again.'));
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    setReplying(true);
    setError(null);
    try {
      await createCourseDiscussionPost(courseId, { content: replyContent.trim(), parentId });
      setReplyContent('');
      setReplyingTo(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? (lang === 'ka' ? 'გამოქვეყნება ვერ მოხერხდა.' : 'Unable to post. Please try again.'));
    } finally {
      setReplying(false);
    }
  };

  const handleDeleted = (id: string) => {
    setPosts((prev) =>
      prev.filter((p) => p.id !== id).map((p) => ({ ...p, replies: p.replies?.filter((r) => r.id !== id) }))
    );
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit}>
        <textarea
          rows={3}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={t.placeholder}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        <button
          type="submit"
          disabled={posting || !newContent.trim()}
          className="mt-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {posting ? t.posting : t.post}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">{t.loading}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500">{t.empty}</p>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <div key={post.id} className="border-t border-slate-800 pt-5">
              <PostRow post={post} lang={lang} canModerate={canModerate} onDeleted={handleDeleted} />

              {(post.replies ?? []).length > 0 && (
                <div className="mt-3 ml-11 space-y-3">
                  {post.replies!.map((reply) => (
                    <PostRow key={reply.id} post={reply} lang={lang} canModerate={canModerate} onDeleted={handleDeleted} />
                  ))}
                </div>
              )}

              <div className="ml-11 mt-2">
                {replyingTo === post.id ? (
                  <div>
                    <textarea
                      rows={2}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={t.replyPlaceholder}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/60 text-white placeholder-slate-500 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => handleReply(post.id)}
                        disabled={replying || !replyContent.trim()}
                        className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        {replying ? t.posting : t.post}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(post.id)}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
                  >
                    {t.reply}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
