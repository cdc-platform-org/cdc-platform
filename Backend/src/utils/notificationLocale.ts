// Shared by emailService.ts and whatsappService.ts's live-training
// notifications — the platform's notification copy only ever exists in two
// languages (matching every other ka/en-only feature in this codebase, see
// englishTutorService.ts's own comment on "real ka/en, English fallback for
// the rest"), so any locale that isn't recognizably English collapses to
// Georgian rather than needing a 1:1 branch per site locale.
export type NotificationLocale = 'ka' | 'en';

export function resolveNotificationLocale(locale: string | null | undefined): NotificationLocale {
  return (locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'ka';
}
