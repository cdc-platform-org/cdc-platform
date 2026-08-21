// Classifies the handful of raw English strings the backend's requireApproved
// / requireRole / requireNotBannedOrDeleted / postingLimitService middleware
// return, so the frontend can show a translated, actionable explanation
// instead of that raw string in a plain red banner. See
// PermissionDeniedModal.tsx for the copy shown per reason.
export type ApiErrorReason = 'PENDING_APPROVAL' | 'BANNED' | 'DEACTIVATED' | 'ROLE_RESTRICTED' | 'MONTHLY_LIMIT';

const RAW_MESSAGE_MATCHERS: { test: (message: string) => boolean; reason: ApiErrorReason }[] = [
  { test: (m) => m.includes('pending administrator approval'), reason: 'PENDING_APPROVAL' },
  { test: (m) => m.includes('has been banned'), reason: 'BANNED' },
  { test: (m) => m.includes('has been deactivated'), reason: 'DEACTIVATED' },
  { test: (m) => m.includes('monthly posting limit'), reason: 'MONTHLY_LIMIT' },
  { test: (m) => m.includes('do not have permission'), reason: 'ROLE_RESTRICTED' },
];

export function classifyApiError(message: string | undefined | null): ApiErrorReason | null {
  if (!message) return null;
  return RAW_MESSAGE_MATCHERS.find((entry) => entry.test(message))?.reason ?? null;
}
