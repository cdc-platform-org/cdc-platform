import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { MessagesSquare, GraduationCap, Briefcase, LifeBuoy, Hash, ArrowRight, LucideIcon } from 'lucide-react';

interface CategoryCardProps {
  id: string;
  slug: string;
  name: string;
  description: string;
  threadCount: number;
}

// Default categories (see Backend/prisma/seed.ts) get a matching icon;
// anything else (custom admin-created categories) falls back to a generic tag.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  general: MessagesSquare,
  courses: GraduationCap,
  freelance: Briefcase,
  help: LifeBuoy,
};

export default function CategoryCard({ slug, name, description, threadCount }: CategoryCardProps) {
  const { t } = useTranslation('forum');
  const Icon = CATEGORY_ICON[slug] ?? Hash;

  return (
    <Link
      href={`/forum/${slug}`}
      className="group relative block rounded-3xl p-6 overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/20 hover:-translate-y-1 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all duration-300 no-underline"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-6 h-6" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{description}</p>
        </div>
      </div>

      <div className="relative flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-500/20">
          {t('threadCount', { count: threadCount })}
        </span>
        <span className="text-xs font-bold text-slate-400 group-hover:text-cyan-500 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
