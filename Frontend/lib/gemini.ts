import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-side only (Next.js API routes run in Node, never shipped to the
// browser bundle) — do not read this from a React component.
// Trimmed and stripped of accidental wrapping quotes: a local .env file goes
// through dotenv, which strips quotes automatically, but hosting dashboards
// (Vercel/Netlify/etc.) store whatever string you paste verbatim — a value
// copied as `"AIza..."` (quotes included) becomes part of the literal key
// and Google's API rejects it as invalid with no indication why.
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

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
- If asked about high-paying jobs, mention that tech, AI engineering, and programming (like Vibe Coding) are at the top right now.

### Career Quiz Flow
The chat widget has a "Start Test" button. When the user clicks it, they send a message meaning "let's start the test" (e.g. "დავიწყოთ ტესტი" / "Start the test"). The moment you see that intent — from this message or anywhere earlier in the conversation history — do NOT greet them again and do NOT ask if they're ready; the conversation history already establishes that. Immediately ask **Question 1 of 3** and nothing else in that reply.

Ask exactly these 3 questions, one at a time, waiting for the user's reply before asking the next one. Never bundle more than one question into a single message:
1. **Interests** — creative & visual work (graphic design, social media/marketing content) vs. logical & technical work (programming, web development, data/analytics).
2. **Experience level** — complete beginner, self-taught/some exposure, or already has some professional experience.
3. **Main goal** — e.g. landing a first job in tech, switching careers, freelancing, or building their own project/business.

Label each question with its number ("**კითხვა 1/3**" / "**Question 1/3**", etc.) so the user can track progress.

Once all 3 answers are in, reply with the final result in this exact structure, using their answers to pick the best-fitting course(s) from the list above:
- A short **შედეგი / Your Result** section naming the matching digital profession(s) and CDC course(s), with one sentence tying the recommendation to their specific answers.
- A direct link to the courses page, always as a Markdown link pointing to exactly this path: [/courses](/courses).
- A dedicated **CDC-ის ექსკლუზიური სარგებელი / Exclusive CDC Benefits** section stating plainly that CDC students get access to the closed Employment Forum (დასაქმების ფორუმი), direct career support, and a professional networking circle — access that people outside CDC do not have. Present this as a concrete reason to enroll, not a minor footnote.

Do not restart the quiz mid-flow unless the user explicitly asks to redo it.`;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('Gemini is not configured (GEMINI_API_KEY missing).');
    this.name = 'GeminiNotConfiguredError';
  }
}

export type ChatTurn = { role: 'user' | 'model'; text: string };

// Helper for the homepage's "CDC Career Assistant" chat widget
// (pages/api/chat.ts) — `lang` steers the reply language, matching the
// widget's GEO/ENG toggle. `history` carries prior turns so multi-step
// flows (like the career quiz) have the context to know which question
// comes next instead of treating every message as a fresh conversation.
export async function askCdcAssistant(message: string, lang: 'GEO' | 'ENG', history: ChatTurn[] = []): Promise<string> {
  if (!client) throw new GeminiNotConfiguredError();

  const model = client.getGenerativeModel({
    // "gemini-2.5-pro" / "gemini-pro-latest" both return a hard 0 free-tier
    // quota on this account (confirmed via direct API probes) — only the
    // Flash family has real free-tier headroom, so that's what's wired up
    // until the Google Cloud project has billing enabled for Pro models.
    model: 'gemini-flash-latest',
    systemInstruction: `${SYSTEM_PROMPT}\n\nAlways respond in the language requested by the user. Current language: ${lang === 'GEO' ? 'Georgian' : 'English'}.`,
  });

  // The Gemini SDK requires chat history (if any) to start with a 'user'
  // turn — the widget's hardcoded opening bot greeting isn't a real turn,
  // so callers are expected to have already stripped it before this point.
  const chat = model.startChat({
    history: history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
  });
  const result = await chat.sendMessage(message);
  return result.response.text();
}
