import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { ForumCategory } from '../../../src/types/forum';
import { getCategories, createThread } from '../../../src/services/forumService';

function NewThreadContent() {
  const router = useRouter();
  const { categorySlug } = router.query;
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [resolvingCategory, setResolvingCategory] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof categorySlug !== 'string') return;
    getCategories()
      .then((categories) => {
        const matched = categories.find((c) => c.slug === categorySlug);
        if (!matched) {
          setNotFound(true);
        } else {
          setCategory(matched);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setResolvingCategory(false));
  }, [categorySlug]);

  const validate = () => {
    const e: { title?: string; content?: string } = {};
    if (title.trim().length < 5) e.title = 'Title must be at least 5 characters.';
    if (content.trim().length < 10) e.content = 'Post content must be at least 10 characters.';
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (!category) return;
    setSubmitting(true);

    try {
      const thread = await createThread({
        categoryId: category.id,
        title: title.trim(),
        content: content.trim(),
      });
      router.push(`/forum/thread/${thread.id}`);
    } catch {
      setSubmitError('Unable to post your thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      hasError ? 'border-red-300' : 'border-gray-300'
    }`;

  if (resolvingCategory) {
    return <p className="text-center text-sm text-gray-400 py-10">Loading…</p>;
  }

  if (notFound || !category) {
    return <p className="text-center text-sm text-gray-500 py-10">This category doesn't exist.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href={`/forum/${categorySlug}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {category.name}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2 mb-8">New Thread</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {submitError && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass(!!errors.title)}
                placeholder="What's your question or topic?"
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Content</label>
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={inputClass(!!errors.content)}
                placeholder="Share the details…"
              />
              {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Posting…' : 'Post Thread'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <ProtectedRoute>
      <NewThreadContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});