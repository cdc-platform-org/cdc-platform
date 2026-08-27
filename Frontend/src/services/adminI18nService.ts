import apiClient from './apiClient';

export interface I18nAgentPatchedGroup {
  locale: string;
  namespace: string;
  keysPatched: number;
}

export interface I18nAgentSkippedKey {
  locale: string;
  namespace: string;
  key: string;
}

export interface I18nAgentRunResult {
  configured: boolean;
  patchedGroups: I18nAgentPatchedGroup[];
  skippedNonStringKeys: I18nAgentSkippedKey[];
  totalKeysPatched: number;
  validationPassed: boolean | null;
  gitBranch: string | null;
  message: string;
}

// Scans public/locales for missing/empty keys vs en/, drafts translations
// via Gemini, and commits the patch to a new LOCAL git branch — never
// pushes, never touches main. See Backend's aiTranslationAgent.ts for why.
export async function runI18nAutoTranslateAgent(): Promise<I18nAgentRunResult> {
  const response = await apiClient.post<{ data: I18nAgentRunResult }>('/admin/i18n/auto-translate-and-push');
  return response.data.data;
}
