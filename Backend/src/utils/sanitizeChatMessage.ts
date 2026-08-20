// Anti-circumvention filter — masks contact info and off-platform-payment
// signals in chat messages so participants can't easily arrange to pay
// outside the platform's escrow (which is how CDC's commission is protected).
// This MUST run server-side (here) as the authoritative check — a client-side
// copy of this same logic exists purely for instant UI feedback and is not
// trustworthy on its own, since any client-side-only filter is trivially
// bypassed by a modified request.

export interface SanitizeChatMessageResult {
  sanitized: string;
  wasFiltered: boolean;
}

const MASK = '[BLOCKED FOR SAFETY]';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// GE12AB1234567890123456-style codes: 2 letters + 2 digits + 10-30 alphanumerics.
const IBAN_PATTERN = /\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}\b/g;

// Digit runs that could be a phone number, allowing common separators.
const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{5,}\d)/g;

const EXTERNAL_CONTACT_PATTERN =
  /\b(whats ?app|wa\.me|telegram|t\.me|viber|messenger|signal|skype|instagram|insta\b|ვაცაპი|ტელეგრამი|ვაიბერი|ინსტაგრამი|პირდაპირი გადარიცხვა|ბანკის გადარიცხვა|ბოგ(ის)? გადარიცხვა|ბარათზე გადარიცხვა|direct transfer|bank transfer|bog transfer|card transfer|cash payment|off[- ]?platform)\b/gi;

// @handle-style social mentions (Instagram/Telegram/X/etc.) — a bare
// "@word" has no legitimate use in this platform's chat context, so this is
// safe to always mask without the false-positive risk phone/IBAN detection
// has to guard against above.
const SOCIAL_HANDLE_PATTERN = /@[a-zA-Z0-9_.]{3,30}\b/g;

function maskAll(text: string, pattern: RegExp): { text: string; matched: boolean } {
  let matched = false;
  const result = text.replace(pattern, () => {
    matched = true;
    return MASK;
  });
  return { text: result, matched };
}

// A bare "7+ digit run" regex would also catch invoice numbers, years, etc.
// Only treat a candidate as a phone number if it has between 7 and 15 digits
// once separators are stripped (the E.164 range).
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

  const handles = maskAll(sanitized, SOCIAL_HANDLE_PATTERN);
  sanitized = handles.text;
  wasFiltered = wasFiltered || handles.matched;

  return { sanitized, wasFiltered };
}
