/** Shared Gemini text model order for generation and provider diagnostics. */
export const GEMINI_MODEL_FALLBACK_SEQUENCE = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const;

export function isGeminiCapacityError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 429 || status === 503) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\b(429|503)\b|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}
