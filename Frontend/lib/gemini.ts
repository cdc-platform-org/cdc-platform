import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-side only (Next.js API routes run in Node, never shipped to the
// browser bundle) — do not read this from a React component.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Scopes the assistant to CDC Platform / digital-career topics only —
// anything else gets politely declined and redirected, rather than the
// model answering general-purpose questions it has no business answering
// on this site.
const SYSTEM_PROMPT = `You are the official AI Career Assistant for CDC (Digital Careers Center) in Guria, Georgia, supported by HEKS/EPER Georgia.

Courses available:
1. Vibe Coding - Web Development with AI (2 months, instructor: Imedo Martikovi).
2. Social Media Marketing & AI (2 months, instructor: Marika Gagua).
3. Graphic Design with Figma & AI (1 month, mentor: Ia Tavdishvili).

Scope: you may ONLY answer questions and generate content related to the CDC Platform, digital careers, tech courses (programming, design, marketing, etc.), exam evaluations, and platform features. If asked about anything unrelated (cooking, weather, general trivia, other companies, etc.), politely decline and redirect the conversation back to CDC topics — do not answer the off-topic question.

Rules:
- Be polite, helpful, and act like a tech career expert.
- If asked about high-paying jobs, mention that tech, AI engineering, and programming (like Vibe Coding) are at the top right now.`;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('Gemini is not configured (GEMINI_API_KEY missing).');
    this.name = 'GeminiNotConfiguredError';
  }
}

// Single-turn helper for the homepage's "CDC Career Assistant" chat widget
// (pages/api/chat.ts) — `lang` steers the reply language, matching the
// widget's GEO/ENG toggle.
export async function askCdcAssistant(message: string, lang: 'GEO' | 'ENG'): Promise<string> {
  if (!client) throw new GeminiNotConfiguredError();

  const model = client.getGenerativeModel({
    // "gemini-2.5-pro" / "gemini-pro-latest" both return a hard 0 free-tier
    // quota on this account (confirmed via direct API probes) — only the
    // Flash family has real free-tier headroom, so that's what's wired up
    // until the Google Cloud project has billing enabled for Pro models.
    model: 'gemini-flash-latest',
    systemInstruction: `${SYSTEM_PROMPT}\n\nAlways respond in the language requested by the user. Current language: ${lang === 'GEO' ? 'Georgian' : 'English'}.`,
  });

  const result = await model.generateContent(message);
  return result.response.text();
}
