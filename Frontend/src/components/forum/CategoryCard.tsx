import Link from 'next/link';

interface CategoryCardProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  threadCount: number;
}

export default function CategoryCard({ slug, name, description, threadCount }: CategoryCardProps) {
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
          {threadCount} thread{threadCount !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}