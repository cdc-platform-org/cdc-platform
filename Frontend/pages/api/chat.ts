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

    // askCdcAssistant already retries across its own model-fallback sequence
    // (gemini-flash-latest → gemini-1.5-flash → gemini-1.5-pro, 2 attempts
    // each — see lib/gemini.ts) before ever throwing, so this only needs a
    // single call, not its own retry loop on top of that.
    const reply = await askCdcAssistant(message, effectiveLang, sanitizeHistory(history), knowledgeContext, homepageAgent?.systemPrompt);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('[api/chat] Gemini chat error (all attempts exhausted):', describeGeminiError(error));
    return res.status(500).json({
      reply: effectiveLang === 'GEO' ? '❌ ასისტენტთან კავშირის ხარვეზი.' : '❌ Error connecting to the assistant.',
      // Non-sensitive classification only (never the raw Gemini error text,
      // which can echo back request content) — lets the browser network tab
      // distinguish "bad/missing key" from "quota" from "unknown" without
      // needing server log access.
      reason: classifyGeminiError(error),
    });
  }
}

// The Gemini SDK doesn't expose a structured status code — API errors come
// back as an Error whose .message embeds Google's REST status, e.g.
// "[401 Unauthorized] API key not valid..." or "[429 Too Many Requests]
// Resource has been exhausted...". Matched defensively since the SDK gives
// no guarantee on this exact format across versions.
function classifyGeminiError(error: unknown): 'invalid_api_key' | 'quota_exceeded' | 'unavailable' | 'unknown' {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(401|403)\b/.test(message) || /API key not valid|PERMISSION_DENIED/i.test(message)) return 'invalid_api_key';
  if (/\b429\b/.test(message) || /RESOURCE_EXHAUSTED|quota/i.test(message)) return 'quota_exceeded';
  if (/\b503\b/.test(message) || /overloaded|UNAVAILABLE/i.test(message)) return 'unavailable';
  return 'unknown';
}

function describeGeminiError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
