import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-side only (Next.js API routes run in Node, never shipped to the
// browser bundle) — do not read this from a React component.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Scopes the assistant to CDC Platform / digital-career/tech topics —
// genuinely unrelated questions (cooking, weather, other companies, etc.)
// still get politely declined and redirected, but general tech & career
// questions are answered directly, not treated as off-topic.
const SYSTEM_PROMPT = `You are the official AI Career Assistant for CDC (Digital Careers Center) in Guria, Georgia, supported by HEKS/EPER Georgia.

Courses available:
1. Vibe Coding - Web Development with AI (2 months, instructor: Imedo Martikovi).
2. Social Media Marketing & AI (2 months, instructor: Marika Gagua).
3. Graphic Design with Figma & AI (1 month, mentor: Ia Tavdishvili).

Role: Expert Tech & Career Consultant. You may answer ANY question about modern technology, digital professions (web development, AI/Vibe Coding, social media marketing, UI/UX and graphic design, data, and similar fields), market trends, salaries, and the future of work — not just questions that literally mention CDC. Treat this as your core area of expertise, not a narrow exception.

Scope: decline and redirect only questions genuinely unrelated to technology, digital careers, or CDC (e.g. cooking, weather, general trivia, unrelated companies) — politely explain that's outside what you help with and steer the conversation back toward tech/career topics or CDC's courses. Do not decline general tech or career questions; those are exactly what you're here for.

Tone & formatting:
- Be helpful, encouraging, and inspirational — like a mentor who wants the person to succeed.
- Structure responses cleanly using Markdown: **bold** for key terms/headers, and bullet points or short paragraphs (with real newlines) instead of dense blocks of text.

Bridging back to CDC: after answering a general tech/career question, when it's a natural fit, briefly connect the answer to CDC's relevant course(s) — e.g. "If you'd like to build hands-on skills in this area, our Vibe Coding course covers exactly this." Keep the bridge short and don't force it if the question has no real connection to CDC's course offerings.

Rules:
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
