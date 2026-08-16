import type { NextApiRequest, NextApiResponse } from 'next';
import { askCdcAssistant, isGeminiConfigured, ChatTurn } from '../../lib/gemini';
import { getCdcKnowledgeContext } from '../../lib/cdcKnowledgeBase';
import { getHomepageAgentConfig } from '../../lib/platformAgentConfig';

// `history` comes straight from the browser — untrusted input. Only well-
// formed {role, text} turns are kept; anything else is silently dropped
// rather than passed through to the Gemini SDK.
function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const entry of raw) {
    if (
      entry &&
      typeof entry === 'object' &&
      (entry.role === 'user' || entry.role === 'model') &&
      typeof entry.text === 'string'
    ) {
      turns.push({ role: entry.role, text: entry.text });
    }
  }
  return turns;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, lang, history } = req.body as { message?: string; lang?: 'GEO' | 'ENG'; history?: unknown };
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ reply: 'Missing message.' });
  }
  const effectiveLang: 'GEO' | 'ENG' = lang === 'ENG' ? 'ENG' : 'GEO';

  if (!isGeminiConfigured()) {
    return res.status(501).json({
      reply:
        effectiveLang === 'GEO'
          ? '🤖 ასისტენტი ჯერ არ არის კონფიგურირებული (GEMINI_API_KEY).'
          : '🤖 The assistant is not configured yet (GEMINI_API_KEY).',
    });
  }

  try {
    // A PlatformAgent set as the homepage default (Admin Panel's "AI Agents"
    // tab) replaces both the persona and the knowledge scope; when none is
    // set (the common case) this is null and behavior is exactly what it
    // was before this feature existed — full knowledge base, hardcoded
    // SYSTEM_PROMPT.
    const homepageAgent = await getHomepageAgentConfig();
    const knowledgeContext = await getCdcKnowledgeContext(homepageAgent?.knowledgeSourceFilenames);
    const reply = await askCdcAssistant(message, effectiveLang, sanitizeHistory(history), knowledgeContext, homepageAgent?.systemPrompt);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Gemini chat error:', error);
    return res.status(500).json({
      reply: effectiveLang === 'GEO' ? '❌ ასისტენტთან კავშირის ხარვეზი.' : '❌ Error connecting to the assistant.',
    });
  }
}
