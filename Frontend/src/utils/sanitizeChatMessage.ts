// Client-side mirror of Backend/src/utils/sanitizeChatMessage.ts — gives the
// sender instant feedback on what will be masked, but is NOT the real
// enforcement. The server re-runs the same logic on every message before
// storing it, since a client-only filter can always be bypassed by whoever
// controls the client (e.g. calling the API directly).

export interface SanitizeChatMessageResult {
  sanitized: string;
  wasFiltered: boolean;
}

const MASK = '[BLOCKED FOR SAFETY]';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IBAN_PATTERN = /\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}\b/g;

const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{5,}\d)/g;

const EXTERNAL_CONTACT_PATTERN =
  /\b(whats ?app|wa\.me|telegram|t\.me|viber|messenger|signal|skype|ვაცაპი|ტელეგრამი|ვაიბერი|პირდაპირი გადარიცხვა|direct transfer|bank transfer|cash payment|off[- ]?platform)\b/gi;

function maskAll(text: string, pattern: RegExp): { text: string; matched: boolean } {
  let matched = false;
  const result = text.replace(pattern, () => {
    matched = true;
    return MASK;
  });
  return { text: result, matched };
}

function isLikelyPhoneNumber(candidate: string): boolean {
  const digitsOnly = candidate.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

function maskPhoneNumbers(text: string): { text: string; matched: boolean } {
  let matched = false;
  const result = text.replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    if (isLikelyPhoneNumber(candidate)) {
      matched = true;
      return MASK;
    }
    return candidate;
  });
  return { text: result, matched };
}

export function sanitizeChatMessage(text: string): SanitizeChatMessageResult {
  let sanitized = text;
  let wasFiltered = false;

  const email = maskAll(sanitized, EMAIL_PATTERN);
  sanitized = email.text;
  wasFiltered = wasFiltered || email.matched;

  const iban = maskAll(sanitized, IBAN_PATTERN);
  sanitized = iban.text;
  wasFiltered = wasFiltered || iban.matched;

  const phone = maskPhoneNumbers(sanitized);
  sanitized = phone.text;
  wasFiltered = wasFiltered || phone.matched;

  const links = maskAll(sanitized, EXTERNAL_CONTACT_PATTERN);
  sanitized = links.text;
  wasFiltered = wasFiltered || links.matched;

  return { sanitized, wasFiltered };
}
