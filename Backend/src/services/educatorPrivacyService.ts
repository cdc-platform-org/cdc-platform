// ============================================================
// D8 — Educator AI privacy/minimization layer. Deterministic, best-effort
// removal of the most obvious hard identifiers (emails, formatted phone
// numbers, bare national-ID-shaped digit runs) from free text before it is
// interpolated into a prompt sent to an external AI provider (see
// aiAgentService.ts's callTextModel, the single call path every Educator
// Hub generator and the Teacher Quiz free-text grader go through).
//
// This is explicitly NOT a PII detector. It does not — and cannot reliably
// — catch names, addresses, or medical/diagnostic text typed in prose;
// that remains a user-responsibility concern surfaced via inline UI
// warnings (see educator-hub.tsx), not something this layer silently
// "fixes". See the product-approved D7/D8 design report for the full
// deterministic / heuristic / user-responsibility / server-enforcement
// split this function implements the deterministic slice of.
// ============================================================

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Phone numbers that announce themselves as phone numbers via formatting —
// a leading + (country code) or digit groups separated by spaces/dashes,
// 7-18 characters total. Deliberately does NOT match bare, unformatted
// digit runs (see ID_PATTERN below) — without locale-specific knowledge
// this layer doesn't have, an unformatted digit run is indistinguishable
// from a personal ID number, so it's covered by that pattern instead.
const PHONE_PATTERN = /\+\d[\d\s-]{6,17}\d|\b\d{2,4}[\s-]\d{3}[\s-]\d{3,4}\b/g;

// Bare, unformatted digit runs matching a national-ID-shaped length (9 or
// 11 digits — covers Georgian personal numbers and common passport/
// document numbers). Word-boundaried so this never truncates a longer
// unrelated number (an order id, a year range, etc.) into a false match.
const ID_PATTERN = /\b\d{11}\b|\b\d{9}\b/g;

// Order matters: email first (so its digits/@ never get re-matched by the
// narrower patterns below), then formatted phone numbers, then bare
// ID-shaped digit runs — each replacement removes those characters from
// the string before the next pattern runs, so nothing is double-matched.
export function minimizeForAi(text: string): string {
  if (!text) return text;
  return text.replace(EMAIL_PATTERN, '[EMAIL_REMOVED]').replace(PHONE_PATTERN, '[PHONE_REMOVED]').replace(ID_PATTERN, '[ID_REMOVED]');
}
