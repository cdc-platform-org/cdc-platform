import type { NextApiRequest, NextApiResponse } from 'next';
import { askCdcAssistant, isGeminiConfigured } from '../../lib/gemini';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, lang } = req.body as { message?: string; lang?: 'GEO' | 'ENG' };
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
    const reply = await askCdcAssistant(message, effectiveLang);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Gemini chat error:', error);
    return res.status(500).json({
      reply: effectiveLang === 'GEO' ? '❌ ასისტენტთან კავშირის ხარვეზი.' : '❌ Error connecting to the assistant.',
    });
  }
}
