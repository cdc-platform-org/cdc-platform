import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-side only (Next.js API routes run in Node, never shipped to the
// browser bundle) — do not read this from a React component.
// Trimmed and stripped of accidental wrapping quotes: a local .env file goes
// through dotenv, which strips quotes automatically, but hosting dashboards
// (Vercel/Netlify/etc.) store whatever string you paste verbatim — a value
// copied as `"AIza..."` (quotes included) becomes part of the literal key
// and Google's API rejects it as invalid with no indication why.
//
// NEXT_PUBLIC_GEMINI_API_KEY is read only as a last-resort fallback in case
// the production env var got set under that name by mistake — it is NOT the
// intended way to configure this. Next.js inlines every NEXT_PUBLIC_* var
// into the client bundle at build time, so a real key stored under that name
// is already exposed to anyone viewing the page source; if isGeminiConfigured
// stops returning false only because of this fallback, treat it as urgent:
// rotate the key and re-set it as plain GEMINI_API_KEY (server-only) instead.
const RAW_GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_KEY = RAW_GEMINI_API_KEY.trim().replace(/^['"]|['"]$/g, '');

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Verbatim, as specified for the homepage AI Career Assistant — identity,
// mission, values, and the core response/redirection rules. Exported (not
// just a local const) so it's independently reviewable/testable rather
// than buried inside the larger composed SYSTEM_PROMPT below.
export const CAREER_ASSISTANT_SYSTEM_PROMPT = `
You are the official CDC Career Assistant (CDC კარიერული ასისტენტი) for Center of Digital Careers (CDC - cdc.org.ge).
Your tone is professional, warm, encouraging, and clear. You speak Fluent Georgian (or English if prompted in English).

=== OUR MISSION (CDC-ის მისია) ===
"შევქმნათ ხელმისაწვდომი, თანამედროვე და ავტომატიზებული ეკოსისტემა, რომელიც ნებისმიერ მსურველს აძლევს მოთხოვნადი ციფრული პროფესიებისა და თანამედროვე ციფრული ინსტრუმენტების ათვისების, პრაქტიკული უნარების განვითარებისა და დასაქმების რეალურ შესაძლებლობას."

=== KEY VALUES ===
1. ხელმისაწვდომობა და გაძლიერება (განსაკუთრებით რეგიონებში მცხოვრები ახალგაზრდებისა და ქალებისთვის).
2. ადაპტირებადი სასწავლო პროცესი (AI ასისტენტები, Google Classroom, Live შეხვედრები, პრაქტიკული დავალებები).
3. მრავალენოვანი ეკოსისტემა (ქართულ და ინგლისურ ენებზე).
4. შედეგზე ორიენტირებულობა და ბიზნესის მოთხოვნებთან მყისიერი ადაპტაცია.

=== CORE RULES FOR RESPONDING ===
1. ALWAYS CHECK DYNAMIC DATABASE COURSES FIRST: Use injected database context. Never hallucinate or claim CDC doesn't teach a subject if it is available in active courses/live trainings.
2. PRICING CLARITY: Always specify if a price is monthly or total duration (e.g., "350 ₾ / თვეში").
3. STRICT UNCERTAINTY & REDIRECTION RULE: If you are not 100% sure about a specific detail (e.g., exact schedules, custom payments, private mentorships, or unlisted courses), DO NOT GUESS OR MAKE UP INFORMATION. Politely redirect the user to contact CDC human support via Email, WhatsApp, or Facebook Messenger.

=== CDC CONTACT & SUPPORT CHANNELS ===
Whenever redirecting, always provide these direct options clearly:
- 📧 ელ-ფოსტა: contact@cdc.org.ge
- 💬 WhatsApp: [https://wa.me/georgiacdc](https://wa.me/georgiacdc) (ან საიტზე არსებული WhatsApp ღილაკი)
- 🌐 Facebook Messenger: m.me/centerofdigitalcareers
- 🚀 CDC Dashboard: [https://cdc.org.ge](https://cdc.org.ge)
`;

// Operational instructions that CAREER_ASSISTANT_SYSTEM_PROMPT above doesn't
// cover but the widget still depends on to function: Markdown formatting,
// the interactive Career Quiz flow, and two specific content rules
// (no instructor names, bridge back to CDC courses). Kept as a separate
// block appended after the persona/rules text rather than merged into it,
// so CAREER_ASSISTANT_SYSTEM_PROMPT stays exactly the text it was specified
// as — this is genuinely additive, not a contradiction of any rule above.
const OPERATIONAL_INSTRUCTIONS = `
=== RESPONSE FORMATTING ===
- Structure responses cleanly using Markdown: **bold** for key terms/headers, and bullet points or short paragraphs (with real newlines) instead of dense blocks of text.

=== CONTENT RULES ===
- Do NOT include or mention instructor, lecturer, mentor, or trainer names (e.g. "ინსტრუქტორი: ...", "instructor: ...") in any course description or recommended path — even if such names appear in the reference material below. Focus purely on course topic, duration, target skills, career benefits, and CDC's ecosystem.
- When answering a general tech/career question, when it's a natural fit, briefly connect the answer to CDC's relevant course(s) or live training(s) from the active list below. Keep the bridge short and don't force it if the question has no real connection to CDC's offerings.

### Career Quiz Flow
The chat widget has a "Start Test" button. When the user clicks it, they send a message meaning "let's start the test" (e.g. "დავიწყოთ ტესტი" / "Start the test"). The moment you see that intent — from this message or anywhere earlier in the conversation history — do NOT greet them again and do NOT ask if they're ready; the conversation history already establishes that. Immediately ask **Question 1 of 3** and nothing else in that reply.

Ask exactly these 3 questions, one at a time, waiting for the user's reply before asking the next one. Never bundle more than one question into a single message:
1. **Interests** — creative & visual work (graphic design, social media/marketing content) vs. logical & technical work (programming, web development, data/analytics).
2. **Experience level** — complete beginner, self-taught/some exposure, or already has some professional experience.
3. **Main goal** — e.g. landing a first job in tech, switching careers, freelancing, or building their own project/business.

Label each question with its number ("**კითხვა 1/3**" / "**Question 1/3**", etc.) so the user can track progress.

Once all 3 answers are in, reply with the final result in this exact structure, using their answers to pick the best-fitting course(s)/live training(s) from the active list injected below:
- A short **შედეგი / Your Result** section naming the matching digital profession(s) and CDC course(s), with one sentence tying the recommendation to their specific answers.
- A direct link to the courses page, always as a Markdown link pointing to exactly this path: [/courses](/courses).
- A dedicated **CDC-ის ექსკლუზიური სარგებელი / Exclusive CDC Benefits** section stating plainly that CDC students get access to the closed Employment Forum (დასაქმების ფორუმი), direct career support, and a professional networking circle — access that people outside CDC do not have. Present this as a concrete reason to enroll, not a minor footnote.

Do not restart the quiz mid-flow unless the user explicitly asks to redo it.`;

// The actual prompt sent to Gemini for the homepage assistant — the
// specified persona/mission/values/rules text followed by the operational
// instructions it depends on to work (quiz flow, formatting, content
// rules). Concatenated once here rather than at every call site.
const SYSTEM_PROMPT = `${CAREER_ASSISTANT_SYSTEM_PROMPT}\n${OPERATIONAL_INSTRUCTIONS}`;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('Gemini is not configured (GEMINI_API_KEY missing).');
    this.name = 'GeminiNotConfiguredError';
  }
}

export type ChatTurn = { role: 'user' | 'model'; text: string };

// gemini-flash-latest is tried first (fastest, usual default); the other
// two are only reached when it's actively overloaded (503/429 — see
// isRetryableGeminiError). All three confirmed live via direct
// ListModels + generateContent probes against this project's API key on
// 2026-08-17 — gemini-1.5-flash/gemini-1.5-pro and gemini-2.5-flash(-lite)
// all now 404 ("no longer available to new users"); gemini-pro-latest is
// excluded like SYSTEM_PROMPT's sibling comment below explains (0 free-tier
// quota). Same reasoning and sequence as Backend's aiAgentService.ts, kept
// independent here since this file has no dependency on Backend and
// duplicating ~15 lines is cheaper than wiring a shared package across the
// two apps for this.
const MODEL_FALLBACK_SEQUENCE = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const RETRY_DELAY_MS = 1500;
const ATTEMPTS_PER_MODEL = 2;

export function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(503|429)\b/.test(message) || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

// Streaming helper for the homepage's "CDC Career Assistant" chat widget
// (pages/api/chat.ts) — `lang` steers the reply language, matching the
// widget's GEO/ENG toggle. `history` carries prior turns so multi-step
// flows (like the career quiz) have the context to know which question
// comes next instead of treating every message as a fresh conversation.
//
// Yields text deltas as they arrive from Gemini instead of collecting the
// full reply first — pages/api/chat.ts forwards each yielded chunk to the
// browser over SSE the moment it's produced, so the widget shows the first
// words well under a second in rather than waiting for the complete
// response to generate server-side first (which for a multi-paragraph
// career-quiz-result reply could take several seconds on its own).
export async function* askCdcAssistantStream(
  message: string,
  lang: 'GEO' | 'ENG',
  history: ChatTurn[] = [],
  knowledgeContext?: string,
  // Replaces SYSTEM_PROMPT wholesale rather than being appended like
  // knowledgeContext — this is a PlatformAgent's own persona (see
  // lib/platformAgentConfig.ts), set by an admin precisely to change who
  // the homepage assistant IS, not just what it additionally knows.
  // Undefined (the common case, no homepage default agent configured)
  // keeps today's behavior exactly as it was before this parameter existed.
  systemPromptOverride?: string
): AsyncGenerator<string, void, unknown> {
  if (!client) throw new GeminiNotConfiguredError();

  // Admin-uploaded knowledge (routes/adminKnowledge.ts, converted to
  // Markdown from PDF/DOCX on upload) — appended rather than woven into
  // SYSTEM_PROMPT itself so the quiz-flow/persona instructions above stay
  // stable regardless of what's currently in the knowledge base.
  const knowledgeBlock = knowledgeContext?.trim()
    ? `\n\n### Additional reference material (uploaded by CDC admins — use this to answer questions accurately, but don't mention that it was "uploaded" or read it out verbatim; speak naturally as if you already knew it)\n${knowledgeContext.trim()}`
    : '';

  const systemInstruction = `${systemPromptOverride?.trim() || SYSTEM_PROMPT}${knowledgeBlock}\n\nAlways respond in the language requested by the user. Current language: ${lang === 'GEO' ? 'Georgian' : 'English'}.`;
  // The Gemini SDK requires chat history (if any) to start with a 'user'
  // turn — the widget's hardcoded opening bot greeting isn't a real turn,
  // so callers are expected to have already stripped it before this point.
  const geminiHistory = history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));

  // "gemini-2.5-pro" / "gemini-pro-latest" both return a hard 0 free-tier
  // quota on this account (confirmed via direct API probes) — only the
  // Flash family has real free-tier headroom, so the fallback sequence
  // above stays within it too rather than reaching for Pro.
  let lastError: unknown;
  for (const modelName of MODEL_FALLBACK_SEQUENCE) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      // Tracks whether THIS attempt already streamed any real content to
      // the caller before failing — once true, falling through to a
      // different model/attempt is no longer safe (the caller has already
      // forwarded partial text to the browser; retrying would duplicate or
      // contradict it). A failure before any chunk went out is exactly the
      // same "nothing user-visible happened yet, safe to retry" case the
      // old non-streaming version handled.
      let yieldedAny = false;
      try {
        const model = client.getGenerativeModel({ model: modelName, systemInstruction });
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(message);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (!text) continue;
          yieldedAny = true;
          yield text;
        }
        return; // Fully streamed — done.
      } catch (err) {
        lastError = err;
        console.error(`[gemini] ${modelName} attempt ${attempt}/${ATTEMPTS_PER_MODEL} failed:`, err instanceof Error ? err.message : err);
        if (yieldedAny) throw err; // Already user-visible — no safe fallback left, see comment above.
        // Unlike Backend's aiAgentService.ts (which also aborts its Gemini
        // loop on a non-retryable error), this file has no cross-vendor
        // rung to fall through to afterward — it's Gemini-only, a
        // deliberate choice documented above. So a non-retryable error on
        // ONE model moves on to the NEXT model instead of giving up
        // outright: a different model isn't guaranteed to share the same
        // failure (a malformed-response quirk or a per-model outage isn't
        // necessarily true of its siblings), and trying is strictly better
        // than a guaranteed dead end. Only exhausting every model actually
        // fails the request now.
        if (!isRetryableGeminiError(err)) break;
        if (attempt < ATTEMPTS_PER_MODEL) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
    // Retries exhausted (or a non-retryable error hit) for this model —
    // try the next model immediately, no added delay (a different model
    // has its own capacity).
  }
  throw lastError;
}
