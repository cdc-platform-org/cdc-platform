// Canonical list of IMIAKO English Tutor support/native-language options —
// "what language should IMIAKO use to explain English to me", a concept
// deliberately decoupled from CDC's site UI locale (see
// Backend's TutorLesson.nativeLang schema comment and utils/locale.ts's
// contentLocale — a learner can browse CDC in Georgian while learning
// English *from* Ukrainian, Russian, etc.). The underlying field
// (User.tutorNativeLang / TutorLesson.nativeLang) stays free-text
// server-side (a new language needs no backend change), but the UI must
// not expose that as a raw text box — this is the single source of truth
// for every selector that picks from it (TutorOnboardingFlow,
// EnglishTutorPanel's settings, BeginnerPathRunner's language switcher),
// replacing what used to be two separately hand-maintained, already-drifted
// lists (TutorOnboardingFlow had 9 entries, EnglishTutorPanel's datalist
// only 6 of the same 9).
export interface TutorSupportLanguageOption {
  code: string;
  nativeName: string; // human-readable name IN that language, e.g. "Deutsch" not "German"
}

export const TUTOR_SUPPORT_LANGUAGES: TutorSupportLanguageOption[] = [
  { code: 'ka', nativeName: 'ქართული' },
  { code: 'en', nativeName: 'English' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'uk', nativeName: 'Українська' },
  { code: 'tr', nativeName: 'Türkçe' },
  { code: 'hy', nativeName: 'Հայերեն' },
  { code: 'az', nativeName: 'Azərbaycan dili' },
  { code: 'ru', nativeName: 'Русский' },
];

export function tutorSupportLanguageName(code: string): string {
  return TUTOR_SUPPORT_LANGUAGES.find((l) => l.code === code)?.nativeName ?? code;
}
