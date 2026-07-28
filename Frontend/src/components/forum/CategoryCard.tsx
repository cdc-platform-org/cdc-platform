import Link from 'next/link';
import { useTranslation } from 'next-i18next';

interface CategoryCardProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  threadCount: number;
}

export default function CategoryCard({ slug, name, description, threadCount }: CategoryCardProps) {
  const { t } = useTranslation('forum');
  return (
    <Link
      href={`/forum/${slug}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <span className="text-xs font-medium text-gray-400 whitespace-nowrap ml-4">
          {t('threadCount', { count: threadCount })}
        </span>
      </div>
    </Link>
  );
}