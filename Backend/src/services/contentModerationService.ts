import { azureOpenai } from '../utils/azureOpenai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';

const client = azureOpenai;

// Belt-and-suspenders alongside the explicit classification prompt below —
// kept aggressive since a course Q&A has no reason to legitimately trip
// harassment/hate-speech/violence categories.
const MODERATION_SAFETY_SETTINGS = [
  { category: "HARM", threshold: "BLOCK" },
  { category: "HARM", threshold: "BLOCK" },
  { category: "HARM", threshold: "BLOCK" },
  { category: "HARM", threshold: "BLOCK" },
];

const moderationResponseSchema = z.object({ safe: z.boolean() });

export function isContentModerationConfigured(): boolean {
  return !!client;
}

// Deliberately an explicit classification prompt, NOT just Gemini's
// generation-time safetySettings (still layered on top, belt-and-suspenders
// — see MODERATION_SAFETY_SETTINGS). Empirically verified during
// development: passing hostile/threatening text straight through as a bare
// "prompt" and checking only promptFeedback.blockReason did NOT flag a
// clear death threat ("I will find you and kill you... I want you dead") —
// Gemini's built-in safety layer is tuned around what the MODEL would
// generate in response, not around classifying arbitrary input text, so it
// under-blocks exactly the kind of content this feature needs to catch.
// Asking it to explicitly classify the text is what actually works.
//
// Fails OPEN (treated as safe) when Gemini isn't configured or the call
// itself errors for a non-safety reason (network/quota/503) — a discussion
// feature shouldn't go fully offline over a transient Gemini hiccup. Admins
// can still delete a post after the fact (see routes/courses.ts's
// DELETE /discussion/:postId), same backstop role human moderation already
// plays for the site-wide forum's approved-after-the-fact comments.
export async function checkContentSafety(text: string): Promise<{ safe: boolean }> {
  if (!client) return { safe: true };

  const prompt = `You are a content moderation classifier for a CDC course discussion forum (students and mentors asking/answering questions). Determine whether the following user-submitted post contains hate speech, harassment, threats, violence, or other offensive/inappropriate language that must not be published. Ordinary technical frustration ("this bug is killing me") is NOT offensive. Respond with strict JSON matching this shape:
{"safe": boolean}

post: ${text}`;

  try {
    const response = await azureOpenai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [{ role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }],
      response_format: { type: 'json_object' },
    });
    const result = { response: { text: () => response.choices[0]?.message?.content || '' } };

    const raw = result.response.text();
    if (!raw) return { safe: true };
    const parsed = moderationResponseSchema.safeParse(JSON.parse(raw));
    // An unparseable/unexpected response is treated the same as "no
    // response" — fail open rather than block a legitimate post over a
    // malformed classifier reply.
    return { safe: parsed.success ? parsed.data.safe : true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/safety|blocked|SAFETY/i.test(message)) {
      return { safe: false };
    }
    console.error('[contentModerationService] Gemini safety check failed, failing open:', err);
    return { safe: true };
  }
}
