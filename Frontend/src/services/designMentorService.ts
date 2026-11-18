// API client for the Design Studio AI mentor (POST /api/ai/design-mentor).
// The backend answers in `locale`, the language the student selected on the site.
import apiClient from './apiClient';

export interface DesignMentorTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface DesignMentorRequest {
  locale: string;
  mode: 'photo' | 'vector';
  activeTool?: string;
  documentInfo?: string;
  message: string;
  history: DesignMentorTurn[];
}

const MENTOR_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'];

export async function askDesignMentor(params: DesignMentorRequest, isRetry = false): Promise<string> {
  const locale = MENTOR_LOCALES.includes(params.locale) ? params.locale : 'en';
  try {
    const { data } = await apiClient.post<{ reply: string }>('/ai/design-mentor', {
      ...params,
      locale,
      history: params.history.slice(-12),
    });
    return data.reply;
  } catch (err: any) {
    // 502 = provider overload (same contract as the course tutor); retry once.
    if (err?.response?.status === 502 && !isRetry) {
      await new Promise((r) => setTimeout(r, 1500));
      return askDesignMentor(params, true);
    }
    throw err;
  }
}
