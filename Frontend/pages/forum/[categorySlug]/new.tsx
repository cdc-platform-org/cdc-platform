import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import { ForumCategory } from '../../../src/types/forum';
import { getCategories, createThread } from '../../../src/services/forumService';

function NewThreadContent() {
  const { t } = useTranslation('forum');
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
    if (title.trim().length < 5) e.title = t('titleTooShort');
    if (content.trim().length < 10) e.content = t('contentTooShort');
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
      setSubmitError(t('submitThreadError'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      hasError ? 'border-red-300' : 'border-gray-300'
    }`;

  if (resolvingCategory) {
    return <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">{t('loading')}</p>;
  }

  if (notFound || !category) {
    return <p className="text-center text-sm text-gray-500 dark:text-slate-400 py-10">{t('categoryNotFound')}</p>;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href={`/forum/${categorySlug}`} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          {t('backToCategory', { category: category.name })}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mt-2 mb-8">{t('newThread')}</h1>
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 transition-colors">
          {submitError && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{t('titleLabel')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass(!!errors.title)}
                placeholder={t('titlePlaceholder')}
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{t('contentLabel')}</label>
              <textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={inputClass(!!errors.content)}
                placeholder={t('contentPlaceholder')}
              />
              {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? t('posting') : t('postThread')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <>
      <SiteHeader />
      <ProtectedRoute>
        <NewThreadContent />
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['forum'])) },
});