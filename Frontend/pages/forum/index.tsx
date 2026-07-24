import { useState, useEffect } from 'react';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import CategoryCard from '../../src/components/forum/CategoryCard';
import { ForumCategory } from '../../src/types/forum';
import { getCategories } from '../../src/services/forumService';

function ForumIndexContent() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('Unable to load forum categories. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Community Forum</h1>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500">No categories have been set up yet.</p>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                slug={category.slug}
                name={category.name}
                description={category.description}
                threadCount={category.threadCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForumIndexPage() {
  return <ForumIndexContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});