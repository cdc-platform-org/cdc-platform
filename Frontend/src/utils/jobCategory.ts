import { JobCategory } from '../types/community';
import { SupportedLocale } from './locale';

export const JOB_CATEGORIES: JobCategory[] = ['ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other'];

const JOB_CATEGORY_LABEL_BASE: Record<JobCategory, { ka: string; en: string }> = {
  ui_ux_design: { ka: 'UI/UX დიზაინი', en: 'UI/UX Design' },
  web_development: { ka: 'Web დეველოპმენტი', en: 'Web Development' },
  graphic_design: { ka: 'გრაფიკული დიზაინი', en: 'Graphic Design' },
  digital_marketing: { ka: 'ციფრული მარკეტინგი', en: 'Digital Marketing' },
  other: { ka: 'სხვა', en: 'Other' },
};

// German/Spanish/French/Ukrainian labels haven't been translated yet — fall
// back to English rather than silently showing Georgian.
export const JOB_CATEGORY_LABEL: Record<JobCategory, Record<SupportedLocale, string>> = Object.fromEntries(
  Object.entries(JOB_CATEGORY_LABEL_BASE).map(([category, { ka, en }]) => [
    category,
    { ka, en, de: en, es: en, fr: en, uk: en },
  ])
) as Record<JobCategory, Record<SupportedLocale, string>>;

export function jobCategoryLabel(category: JobCategory | null | undefined, lang: SupportedLocale): string | null {
  if (!category) return null;
  return JOB_CATEGORY_LABEL[category][lang];
}
