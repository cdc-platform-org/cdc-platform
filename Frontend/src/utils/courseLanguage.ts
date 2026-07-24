import { CourseLanguage } from '../types/lms';

export function courseLanguageBadge(language: CourseLanguage, lang: 'ka' | 'en'): string {
  if (language === 'ENGLISH') return lang === 'ka' ? '🇬🇧 ინგლისურენოვანი' : '🇬🇧 English';
  if (language === 'BOTH') return lang === 'ka' ? '🇬🇪🇬🇧 ქართული / ინგლისური' : '🇬🇪🇬🇧 Georgian / English';
  return lang === 'ka' ? '🇬🇪 ქართულენოვანი' : '🇬🇪 Georgian';
}
