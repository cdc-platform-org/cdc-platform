import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Trash2 } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import RichTextEditor from '../../src/components/shared/RichTextEditor';
import { BlogPost, BlogComment } from '../../src/types/blog';
import {
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogImage,
  resolveBlogImageUrl,
  translateBlogPost,
  generateBlogPostWithAi,
  SUCCESS_STORIES_CATEGORY_KA,
  BlogPostPayload,
  getBlogComments,
  deleteBlogComment,
} from '../../src/services/blogService';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';

const emptyForm: BlogPostPayload = {
  title: '',
  description: '',
  category: '',
  content: '',
  titleEn: '',
  descriptionEn: '',
  contentEn: '',
  imageUrl: '',
  published: true,
};

function AdminBlogDashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BlogPostPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'ka' | 'en'>('ka');
  const [translating, setTranslating] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [generatingWithAi, setGeneratingWithAi] = useState(false);
  // 502 is specifically how adminBlog.ts's /generate-ai reports a Gemini-side
  // failure (AiAgentError — see aiAgentService.ts, which already retries
  // across 3 models before giving up) — distinguished so this shows a
  // friendly "try again shortly" message with a Retry button instead of
  // Gemini's raw error text.
  const [aiGenerateOverloaded, setAiGenerateOverloaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment moderation — fetched on demand per post (no dedicated "all
  // comments" admin endpoint exists; the public per-post listing works fine
  // for admins too, and DELETE /blog/comments/:id is already admin-gated).
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, BlogComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBlogPosts();
      setPosts(data);
    } catch {
      setError('სტატიების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      description: post.description,
      category: post.category,
      content: post.content,
      titleEn: post.titleEn ?? '',
      descriptionEn: post.descriptionEn ?? '',
      contentEn: post.contentEn ?? '',
      imageUrl: post.imageUrl ?? '',
      published: post.published,
    });
    setActiveLangTab('ka');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAutoTranslate = async () => {
    setFormError(null);
    if (form.title.trim().length < 3 || form.description.trim().length < 10 || form.content.trim().length < 20) {
      setFormError('თარგმნამდე შეავსეთ ქართული სათაური, აღწერა და კონტენტი.');
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateBlogPost({
        title: form.title.trim(),
        description: form.description.trim(),
        content: form.content.trim(),
      });
      setForm((f) => ({ ...f, ...translated }));
      setActiveLangTab('en');
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'თარგმნა ვერ მოხერხდა.');
    } finally {
      setTranslating(false);
    }
  };

  const handleGenerateWithAi = async () => {
    setFormError(null);
    setAiGenerateOverloaded(false);
    setGeneratingWithAi(true);
    try {
      const draft = await generateBlogPostWithAi(aiTopic.trim() || undefined);
      setForm((f) => ({
        ...f,
        title: draft.title,
        description: draft.description,
        content: draft.content,
        category: draft.category,
        titleEn: draft.titleEn,
        descriptionEn: draft.descriptionEn,
        contentEn: draft.contentEn,
        imageUrl: draft.imageUrl || f.imageUrl,
      }));
      setEditingId(null);
      setActiveLangTab('ka');
    } catch (err: any) {
      if (err?.response?.status === 502) {
        setAiGenerateOverloaded(true);
        setFormError('AI სერვისი დროებით გადატვირთულია. გთხოვთ, სცადოთ ხელახლა 1-2 წუთში.');
      } else {
        setFormError(err?.response?.data?.message ?? 'AI გენერაცია ვერ მოხერხდა.');
      }
    } finally {
      setGeneratingWithAi(false);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setFormError(IMAGE_SIZE_ERROR.ka);
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadBlogImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'სურათის ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.title.trim().length < 3) return setFormError('სათაური ძალიან მოკლეა.');
    if (form.description.trim().length < 10) return setFormError('აღწერა ძალიან მოკლეა.');
    if (!form.category.trim()) return setFormError('კატეგორია სავალდებულოა.');
    if (form.content.trim().length < 20) return setFormError('კონტენტი ძალიან მოკლეა.');

    setSubmitting(true);
    try {
      const payload: BlogPostPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        content: form.content.trim(),
        titleEn: form.titleEn?.trim() || null,
        descriptionEn: form.descriptionEn?.trim() || null,
        contentEn: form.contentEn?.trim() || null,
        imageUrl: form.imageUrl?.trim() || undefined,
        published: form.published,
      };
      if (editingId) {
        const updated = await updateBlogPost(editingId, payload);
        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createBlogPost(payload);
        setPosts((prev) => [created, ...prev]);
      }
      resetForm();
    } catch {
      setFormError('სტატიის შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ სტატიის წაშლა?')) return;
    try {
      await deleteBlogPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('სტატიის წაშლა ვერ მოხერხდა.');
    }
  };

  const toggleComments = async (post: BlogPost) => {
    if (expandedCommentsPostId === post.id) {
      setExpandedCommentsPostId(null);
      return;
    }
    setExpandedCommentsPostId(post.id);
    if (!commentsByPost[post.id]) {
      setCommentsLoading(true);
      try {
        const data = await getBlogComments(post.slug);
        setCommentsByPost((prev) => ({ ...prev, [post.id]: data }));
      } catch {
        setCommentsByPost((prev) => ({ ...prev, [post.id]: [] }));
      } finally {
        setCommentsLoading(false);
      }
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('ნამდვილად გსურთ კომენტარის წაშლა?')) return;
    const previous = commentsByPost[postId] ?? [];
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: previous.filter((c) => c.id !== commentId && c.parentId !== commentId),
    }));
    try {
      await deleteBlogComment(commentId);
    } catch {
      setCommentsByPost((prev) => ({ ...prev, [postId]: previous }));
      setError('კომენტარის წაშლა ვერ მოხერხდა.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>ბლოგის მართვა | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">ბლოგის მართვა</h1>
          <p className="text-sm text-gray-500 mt-1">სტატიების შექმნა, რედაქტირება და წაშლა.</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-md shadow-slate-200/40 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">
            {editingId ? 'სტატიის რედაქტირება' : 'ახალი სტატია'}
          </h2>

          <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
            <p className="text-xs font-semibold text-cyan-900 mb-2">
              CDC AI აგენტი — ავტომატურად შექმნის ორენოვან (KA/EN) სტატიას სათაურით, კატეგორიით, მოკლე აღწერით,
              სრული ტექსტით და ყდის სურათით. გადახედეთ და გამოაქვეყნეთ.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="თემა (არასავალდებულო) — ცარიელი დატოვების შემთხვევაში AI თავად აირჩევს AI/ტექ თემას"
                className="flex-1 rounded-lg border border-cyan-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={generatingWithAi}
                className="shrink-0 whitespace-nowrap text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 px-4 py-2.5 rounded-lg disabled:opacity-60"
              >
                {generatingWithAi ? 'გენერირდება…' : '✨ სტატიის გენერირება AI-ით'}
              </button>
            </div>
          </div>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3 flex-wrap">
              <span>{formError}</span>
              {aiGenerateOverloaded && (
                <button
                  type="button"
                  onClick={handleGenerateWithAi}
                  disabled={generatingWithAi}
                  className="shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  {generatingWithAi ? 'იტვირთება…' : 'ხელახლა ცდა'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">კატეგორია</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={`${inputClass} flex-1`}
                  placeholder="ტექნოლოგიები, მარკეტინგი..."
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: SUCCESS_STORIES_CATEGORY_KA })}
                  className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg whitespace-nowrap"
                >
                  🎓 Mark as Success Story
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200">
              <div className="flex gap-1">
                {(['ka', 'en'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveLangTab(tab)}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                      activeLangTab === tab
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab === 'ka' ? '🇬🇪 ქართული' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAutoTranslate}
                disabled={translating}
                className="mb-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg disabled:opacity-60"
              >
                {translating ? 'ითარგმნება…' : '✨ Auto-Translate to English'}
              </button>
            </div>

            {activeLangTab === 'ka' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">სათაური (KA)</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                    placeholder="სტატიის სათაური"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">მოკლე აღწერა (KA)</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inputClass}
                    placeholder="მოკლე აღწერა, რომელიც გამოჩნდება სიაში..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">კონტენტი (KA)</label>
                  <RichTextEditor rows={8} value={form.content} onChange={(v) => setForm({ ...form, content: v })} placeholder="სტატიის სრული ტექსტი..." />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title (EN)</label>
                  <input
                    type="text"
                    value={form.titleEn ?? ''}
                    onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                    className={inputClass}
                    placeholder="Article title — falls back to Georgian if left blank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Short description (EN)</label>
                  <textarea
                    rows={2}
                    value={form.descriptionEn ?? ''}
                    onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                    className={inputClass}
                    placeholder="Shown in listings — falls back to Georgian if left blank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Content (EN)</label>
                  <RichTextEditor
                    rows={8}
                    value={form.contentEn ?? ''}
                    onChange={(v) => setForm({ ...form, contentEn: v })}
                    placeholder="Full article body — falls back to Georgian if left blank"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                სურათი <span className="text-gray-400 font-normal">(URL ან ატვირთვა)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={form.imageUrl ?? ''}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className={`${inputClass} flex-1`}
                  placeholder="https://..."
                />
                <label className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  {uploading ? 'იტვირთება…' : '📁 ატვირთვა'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              {form.imageUrl && (
                <img
                  src={resolveBlogImageUrl(form.imageUrl)}
                  alt="გადახედვა"
                  onError={onImageErrorFallback}
                  className="mt-3 h-32 w-auto rounded-lg border border-gray-200 object-cover"
                />
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.published ?? true}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამოქვეყნებულია
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'გამოქვეყნება'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  გაუქმება
                </button>
              )}
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">გამოქვეყნებული სტატიები ({posts.length})</h2>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-gray-500">სტატიები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    {post.imageUrl ? (
                      <img
                        src={resolveBlogImageUrl(post.imageUrl)}
                        alt=""
                        onError={onImageErrorFallback}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {post.category}
                        </span>
                        {!post.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            დრაფტი
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">{post.title}</h3>
                      <p className="text-xs text-gray-500 truncate">{post.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {post.published && (
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          <ExternalLink size={13} /> გახსნა
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleComments(post)}
                        className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg ${
                          expandedCommentsPostId === post.id ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <MessageSquare size={13} /> კომენტარები
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(post)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                      >
                        რედაქტირება
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                      >
                        წაშლა
                      </button>
                    </div>
                  </div>

                  {expandedCommentsPostId === post.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {commentsLoading && !commentsByPost[post.id] ? (
                        <p className="text-xs text-gray-400">იტვირთება…</p>
                      ) : (commentsByPost[post.id] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400">კომენტარები არ არის.</p>
                      ) : (
                        <div className="space-y-2">
                          {(commentsByPost[post.id] ?? []).map((comment) => (
                            <div
                              key={comment.id}
                              className={`flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 ${comment.parentId ? 'ml-6' : ''}`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800">
                                  {comment.author.name} <span className="text-gray-400 font-normal">· {new Date(comment.createdAt).toLocaleDateString()}</span>
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(post.id, comment.id)}
                                aria-label="წაშლა"
                                title="წაშლა"
                                className="shrink-0 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminBlogPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminBlogDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
