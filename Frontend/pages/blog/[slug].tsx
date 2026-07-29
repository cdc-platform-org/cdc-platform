import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';
import { List, Clock, Reply, Trash2 } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { BlogPost, BlogComment } from '../../src/types/blog';
import {
  getBlogPostById,
  getBlogPosts,
  resolveBlogImageUrl,
  blogTitle,
  blogDescription,
  blogContent,
  estimateReadingMinutes,
  isSuccessStory,
  getBlogComments,
  createBlogComment,
  deleteBlogComment,
} from '../../src/services/blogService';
import SocialShareButtons from '../../src/components/shared/SocialShareButtons';
import Lightbox, { LightboxImage } from '../../src/components/shared/Lightbox';
import { onImageErrorFallback } from '../../src/utils/imageFallback';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'სტატია ვერ მოიძებნა.',
    back: '← ბლოგზე დაბრუნება',
    by: 'ავტორი',
    minRead: (n: number) => `${n} წთ კითხვა`,
    toc: 'სარჩევი',
    related: 'დაკავშირებული სტატიები',
    comments: 'კომენტარები',
    signInToComment: 'კომენტარის დასატოვებლად გაიარეთ ავტორიზაცია',
    commentPlaceholder: 'დაწერეთ თქვენი კომენტარი…',
    post: 'გამოქვეყნება',
    posting: 'იგზავნება…',
    reply: 'პასუხი',
    replyPlaceholder: 'დაწერეთ პასუხი…',
    noComments: 'ჯერ არავის დაუტოვებია კომენტარი. იყავით პირველი!',
    commentError: 'კომენტარის გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.',
    delete: 'წაშლა',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Article not found.',
    back: '← Back to blog',
    by: 'By',
    minRead: (n: number) => `${n} min read`,
    toc: 'Table of Contents',
    related: 'Related Articles',
    comments: 'Comments',
    signInToComment: 'Please sign in to leave a comment',
    commentPlaceholder: 'Write your comment…',
    post: 'Post',
    posting: 'Posting…',
    reply: 'Reply',
    replyPlaceholder: 'Write a reply…',
    noComments: 'No comments yet. Be the first to share your thoughts!',
    commentError: 'Failed to post comment. Please try again.',
    delete: 'Delete',
  },
};

// No rehype-slug plugin in this project — headings get stable anchor ids by
// deriving them from the raw markdown source (extractHeadings) and
// re-deriving them in the exact same document order while ReactMarkdown
// renders (headingIndexRef below), so both passes agree.
function slugifyHeading(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'section';
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(markdown: string): Heading[] {
  const seen = new Map<string, number>();
  const headings: Heading[] = [];
  for (const rawLine of markdown.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(rawLine.trim());
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    let id = slugifyHeading(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    headings.push({ id, text, level });
  }
  return headings;
}

interface ContentImage {
  url: string;
  alt: string;
}

// Extracted straight from the markdown source (not the rendered DOM) — same
// "parse the raw string, then re-derive in the same order while
// ReactMarkdown renders" approach as extractHeadings, via contentImageIndexRef.
function extractContentImages(markdown: string): ContentImage[] {
  const images: ContentImage[] = [];
  const regex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown))) {
    images.push({ alt: match[1], url: match[2] });
  }
  return images;
}

interface CommentThreadProps {
  comment: BlogComment;
  replies: BlogComment[];
  lang: 'ka' | 'en';
  t: (typeof dict)['ka'];
  canModerate: boolean;
  onReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
  replyingTo: string | null;
  replyContent: string;
  onReplyContentChange: (value: string) => void;
  onSubmitReply: (e: FormEvent, parentId: string) => void;
  submitting: boolean;
}

function CommentHeader({
  comment,
  lang,
  t,
  canModerate,
  onDelete,
}: {
  comment: BlogComment;
  lang: 'ka' | 'en';
  t: (typeof dict)['ka'];
  canModerate: boolean;
  onDelete: (commentId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {comment.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveBlogImageUrl(comment.author.avatarUrl)} alt={comment.author.name} onError={onImageErrorFallback} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black">
            {comment.author.name.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="text-sm font-bold text-white">{comment.author.name}</p>
        <span className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US')}</span>
      </div>
      {canModerate && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          aria-label={t.delete}
          title={t.delete}
          className="text-slate-600 hover:text-red-400 bg-transparent cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function CommentThread({
  comment,
  replies,
  lang,
  t,
  canModerate,
  onReply,
  onDelete,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  submitting,
}: CommentThreadProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <CommentHeader comment={comment} lang={lang} t={t} canModerate={canModerate} onDelete={onDelete} />
      <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap break-words">{comment.content}</p>
      <button
        type="button"
        onClick={() => onReply(comment.id)}
        className="flex items-center gap-1 text-xs font-bold text-cyan-400 mt-3 bg-transparent cursor-pointer hover:text-cyan-300"
      >
        <Reply size={12} /> {t.reply}
      </button>

      {replyingTo === comment.id && (
        <form onSubmit={(e) => onSubmitReply(e, comment.id)} className="mt-3">
          <textarea
            rows={2}
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder={t.replyPlaceholder}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold text-white bg-cyan-600 px-3.5 py-1.5 rounded-lg hover:bg-cyan-500 disabled:opacity-60"
            >
              {submitting ? t.posting : t.post}
            </button>
          </div>
        </form>
      )}

      {replies.length > 0 && (
        <div className="mt-4 pl-5 border-l border-slate-800 space-y-3">
          {replies.map((reply) => (
            <div key={reply.id}>
              <CommentHeader comment={reply} lang={lang} t={t} canModerate={canModerate} onDelete={onDelete} />
              <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap break-words">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BlogPostPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : null;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const canModerateComments = user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'MANAGER';

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getBlogPostById(slug);
      if (!data.published) {
        setNotFound(true);
      } else {
        setPost(data);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!post) {
      setRelatedPosts([]);
      return;
    }
    getBlogPosts(post.category)
      .then((data) => setRelatedPosts(data.filter((p) => p.published && p.id !== post.id).slice(0, 3)))
      .catch(() => setRelatedPosts([]));
  }, [post]);

  const loadComments = useCallback(async () => {
    if (!slug) return;
    try {
      setComments(await getBlogComments(slug));
    } catch {
      // Non-fatal — the article itself already loaded; comments just stay empty.
    }
  }, [slug]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const content = post ? blogContent(post, lang) : '';
  const headings = useMemo(() => extractHeadings(content), [content]);
  const headingIndexRef = useRef(0);
  headingIndexRef.current = 0;

  const contentImages = useMemo(() => extractContentImages(content), [content]);
  // Cover image (when present) occupies index 0; content images follow in
  // document order — contentImageIndexRef mirrors headingIndexRef's trick of
  // re-deriving the same order while ReactMarkdown renders.
  const galleryImages = useMemo<LightboxImage[]>(() => {
    const items: LightboxImage[] = [];
    if (post?.imageUrl) items.push({ url: resolveBlogImageUrl(post.imageUrl), alt: blogTitle(post, lang) });
    for (const img of contentImages) items.push({ url: resolveBlogImageUrl(img.url), alt: img.alt });
    return items;
  }, [post, contentImages, lang]);
  const contentImageIndexRef = useRef(0);
  contentImageIndexRef.current = post?.imageUrl ? 1 : 0;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const markdownComponents = useMemo(
    () => ({
      h2: (props: React.ComponentPropsWithoutRef<'h2'>) => {
        const heading = headings[headingIndexRef.current];
        headingIndexRef.current += 1;
        return <h2 id={heading?.id} className="text-xl font-black mt-8 mb-3 text-white scroll-mt-24" {...props} />;
      },
      h3: (props: React.ComponentPropsWithoutRef<'h3'>) => {
        const heading = headings[headingIndexRef.current];
        headingIndexRef.current += 1;
        return <h3 id={heading?.id} className="text-lg font-black mt-6 mb-2 text-white scroll-mt-24" {...props} />;
      },
      p: (props: React.ComponentPropsWithoutRef<'p'>) => <p className="mb-4 leading-relaxed text-slate-300" {...props} />,
      a: (props: React.ComponentPropsWithoutRef<'a'>) => <a className="underline text-cyan-400 hover:text-cyan-300" target="_blank" rel="noopener noreferrer" {...props} />,
      ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-5 mb-4 space-y-1 text-slate-300" {...props} />,
      ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-slate-300" {...props} />,
      blockquote: (props: React.ComponentPropsWithoutRef<'blockquote'>) => (
        <blockquote className="border-l-4 border-cyan-500/50 pl-4 italic text-slate-400 my-5" {...props} />
      ),
      code: (props: React.ComponentPropsWithoutRef<'code'>) => (
        <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[13px]" {...props} />
      ),
      img: (props: React.ComponentPropsWithoutRef<'img'>) => {
        const idx = contentImageIndexRef.current;
        contentImageIndexRef.current += 1;
        return (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            {...props}
            src={props.src ? resolveBlogImageUrl(props.src) : props.src}
            onError={onImageErrorFallback}
            onClick={() => setLightboxIndex(idx)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setLightboxIndex(idx);
              }
            }}
            role="button"
            tabIndex={0}
            className="w-full rounded-xl my-5 cursor-zoom-in"
          />
        );
      },
    }),
    [headings]
  );

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    if (!isAuthenticated) {
      openAuthModal({ message: { ka: dict.ka.signInToComment, en: dict.en.signInToComment } });
      return;
    }
    if (newComment.trim().length < 1) return;
    setCommentError(null);
    setSubmittingComment(true);
    try {
      const created = await createBlogComment(slug, { content: newComment.trim() });
      setComments((prev) => [created, ...prev]);
      setNewComment('');
    } catch {
      setCommentError(t.commentError);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (e: FormEvent, parentId: string) => {
    e.preventDefault();
    if (!slug) return;
    if (!isAuthenticated) {
      openAuthModal({ message: { ka: dict.ka.signInToComment, en: dict.en.signInToComment } });
      return;
    }
    if (replyContent.trim().length < 1) return;
    setSubmittingComment(true);
    try {
      const created = await createBlogComment(slug, { content: replyContent.trim(), parentId });
      setComments((prev) => [...prev, created]);
      setReplyContent('');
      setReplyingTo(null);
    } catch {
      setCommentError(t.commentError);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    try {
      await deleteBlogComment(commentId);
    } catch {
      setComments(previous);
      setCommentError(t.commentError);
    }
  };

  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, BlogComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [comments]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t.loading}</div>;
  }
  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 text-sm">
        <p>{t.notFound}</p>
        <Link href="/blog" className="text-cyan-400 hover:underline">
          {t.back}
        </Link>
      </div>
    );
  }

  const title = blogTitle(post, lang);
  const description = blogDescription(post, lang);
  const ogImage = post.imageUrl ? resolveBlogImageUrl(post.imageUrl) : undefined;
  const readingMinutes = estimateReadingMinutes(content);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${title} | CDC Blog`}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Head>
      <div className="max-w-6xl mx-auto">
        <Link href="/blog" className="text-sm text-slate-400 hover:text-white no-underline">
          {t.back}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12 mt-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20">
                {post.category}
              </span>
              {isSuccessStory(post) && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-amber-300 bg-amber-500/10 border-amber-500/20">
                  {lang === 'ka' ? '🎓 კურსდამთავრებული' : '🎓 Graduate Success'}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-black mt-4 mb-4">{title}</h1>

            <div className="flex flex-wrap items-center gap-3 mb-8">
              {post.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveBlogImageUrl(post.author.avatarUrl)} alt={post.author.name} onError={onImageErrorFallback} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black">
                  {post.author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-xs text-slate-500 leading-tight">
                <p className="font-bold text-slate-300">{t.by} {post.author.name}</p>
                <p className="flex items-center gap-2">
                  {new Date(post.createdAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US')}
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {t.minRead(readingMinutes)}
                  </span>
                </p>
              </div>
              <div className="ml-auto">
                <SocialShareButtons title={title} lang={lang} variant="dark" />
              </div>
            </div>

            {post.imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                aria-label={title}
                className="block w-full mb-8 p-0 border-0 bg-transparent cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveBlogImageUrl(post.imageUrl)} alt={title} onError={onImageErrorFallback} className="w-full rounded-2xl object-cover max-h-96" />
              </button>
            )}

            {headings.length > 0 && (
              <div className="lg:hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 mb-8">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  <List size={14} /> {t.toc}
                </p>
                <ul className="space-y-1.5">
                  {headings.map((h) => (
                    <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
                      <a href={`#${h.id}`} className="text-sm text-cyan-400 hover:underline no-underline">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="prose-blog">
              <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
            </div>

            {relatedPosts.length > 0 && (
              <div className="mt-16">
                <h2 className="text-xl font-black mb-6">{t.related}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {relatedPosts.map((related) => (
                    <Link
                      key={related.id}
                      href={`/blog/${related.slug}`}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 no-underline text-current transition-colors hover:border-cyan-400/50"
                    >
                      <p className="text-sm font-bold text-white line-clamp-2 mb-1">{blogTitle(related, lang)}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{blogDescription(related, lang)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-16">
              <h2 className="text-xl font-black mb-6">
                {t.comments} {comments.length > 0 && <span className="text-slate-500">({comments.length})</span>}
              </h2>

              <form onSubmit={handleSubmitComment} className="mb-8">
                {commentError && <p className="text-xs text-red-400 mb-2">{commentError}</p>}
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t.commentPlaceholder}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="text-sm font-bold text-white bg-cyan-600 px-4 py-2 rounded-lg hover:bg-cyan-500 disabled:opacity-60"
                  >
                    {submittingComment ? t.posting : t.post}
                  </button>
                </div>
              </form>

              {topLevelComments.length === 0 ? (
                <p className="text-sm text-slate-500">{t.noComments}</p>
              ) : (
                <div className="space-y-4">
                  {topLevelComments.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      replies={repliesByParent.get(comment.id) ?? []}
                      lang={lang}
                      t={t}
                      canModerate={canModerateComments}
                      onReply={(parentId) => {
                        setReplyingTo((current) => (current === parentId ? null : parentId));
                        setReplyContent('');
                      }}
                      onDelete={handleDeleteComment}
                      replyingTo={replyingTo}
                      replyContent={replyContent}
                      onReplyContentChange={setReplyContent}
                      onSubmitReply={handleSubmitReply}
                      submitting={submittingComment}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {headings.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  <List size={14} /> {t.toc}
                </p>
                <ul className="space-y-1.5">
                  {headings.map((h) => (
                    <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
                      <a href={`#${h.id}`} className="text-sm text-slate-400 hover:text-cyan-400 no-underline">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>
      </div>

      <Lightbox
        images={galleryImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
