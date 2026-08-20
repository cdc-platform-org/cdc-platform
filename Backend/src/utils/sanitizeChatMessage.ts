// Anti-circumvention filter — masks contact info and off-platform-payment
// signals in chat messages so participants can't easily arrange to pay
// outside the platform's escrow (which is how CDC's commission is protected).
// This MUST run server-side (here) as the authoritative check — a client-side
// copy of this same logic exists purely for instant UI feedback and is not
// trustworthy on its own, since any client-side-only filter is trivially
// bypassed by a modified request.

export type ChatFlagSeverity = 'MEDIUM' | 'HIGH';

export interface SanitizeChatMessageResult {
  sanitized: string;
  wasFiltered: boolean;
  // HIGH whenever a phone number, a payment-specific term, or an actual
  // evasion technique (verbal-spelled digits, noise-separated digits) was
  // involved; MEDIUM for a plain direct match (bare email/IBAN, an obvious
  // platform-name mention) with no evasion technique detected. Only
  // meaningful when wasFiltered is true.
  severity: ChatFlagSeverity;
}

const MASK = '[BLOCKED FOR SAFETY]';

// Plain \b word boundaries don't work around Georgian script — \b is
// ASCII-only in JS regex (it's defined off \w, which never matches
// non-Latin letters), so a run of Georgian letters surrounded by spaces has
// no actual \w/non-\w transition at its edges and \b silently fails to
// match there at all (verified directly: /\bხუთი\b/ matches nothing on
// Georgian input). A custom boundary against "not another Georgian letter"
// (U+10A0-U+10FF) is what actually anchors Georgian terms correctly below,
// and does NOT false-positive inside a longer word that happens to contain
// one as a substring (e.g. "ისტორია" contains "ორი").
const GEORGIAN_LETTERS = '\\u10A0-\\u10FF';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// GE12AB1234567890123456-style codes: 2 letters + 2 digits + 10-30 alphanumerics.
const IBAN_PATTERN = /\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}\b/g;

// Digit runs that could be a phone number, allowing common separators.
const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{5,}\d)/g;

// ASCII/Latin communication-platform terms — plain \b works fine, these are
// ordinary word characters.
const LATIN_PLATFORM_TERMS = ['whats ?app', 'wa\\.me', 'telegram', 't\\.me', 'viber', 'messenger', 'signal', 'skype', 'instagram', 'insta\\b'];
// ASCII/Latin payment-specific terms — a HIGH-severity signal on their own,
// not just "here's how to reach me."
const LATIN_PAYMENT_TERMS = ['tbc transfer', 'tbc(?!\\w)', 'direct transfer', 'bank transfer', 'bog transfer', 'card transfer', 'cash payment', 'off[- ]?platform'];
const LATIN_CONTACT_PATTERN = new RegExp(`\\b(${[...LATIN_PLATFORM_TERMS, ...LATIN_PAYMENT_TERMS].join('|')})\\b`, 'gi');
const LATIN_PAYMENT_PATTERN = new RegExp(`\\b(${LATIN_PAYMENT_TERMS.join('|')})\\b`, 'gi');

// Georgian terms are matched by STEM, not whole word — Georgian is
// agglutinative, so "ვაწაპი" (WhatsApp, nominative case) never appears as a
// substring of "ვაწაპში" ("in WhatsApp", locative case) or "ვაწაპზე" ("on
// WhatsApp"), the two case-declined forms someone would actually type. A
// whole-word list would need every case ending spelled out per term; a stem
// + "up to a few more Georgian letters" is the practical fix, since none of
// these stems are real Georgian word roots on their own (they're phonetic
// loanwords/brand names) — a false-positive from an unrelated word sharing
// one of these stems is effectively impossible, unlike a generic digit-word
// like "ორი" which genuinely does appear inside other real words.
const GEORGIAN_PLATFORM_STEMS = [
  'ვაცაპ',
  'ვაწაპ', // phonetic misspelling variant
  'ტელეგრამ',
  'თელეგრამ', // phonetic misspelling variant
  'ვაიბერ',
  'ინსტაგრამ',
];
// Georgian payment-specific stems — HIGH severity on their own. Deliberately
// broad on "ბარათ"/"ანგარიშ"/"გარეთ" per the admin brief's explicit ask
// (card/account/"go outside [the platform]") even though each is also an
// ordinary Georgian word in unrelated contexts (a course completion card, a
// financial report, literally meeting somewhere outdoors) — same "safe
// direction to err in" posture as the rest of this filter.
const GEORGIAN_PAYMENT_STEMS = ['ბარათ', 'ანგარიშ', 'ქარდ', 'ბანკის გადარიცხვ', 'ბოგ(ის)? გადარიცხვ', 'გარეთ'];
const GEORGIAN_CONTACT_PATTERN = new RegExp(
  `(?<![${GEORGIAN_LETTERS}])(${[...GEORGIAN_PLATFORM_STEMS, ...GEORGIAN_PAYMENT_STEMS].join('|')})[${GEORGIAN_LETTERS}]{0,4}`,
  'g'
);
const GEORGIAN_PAYMENT_PATTERN = new RegExp(`(?<![${GEORGIAN_LETTERS}])(${GEORGIAN_PAYMENT_STEMS.join('|')})[${GEORGIAN_LETTERS}]{0,4}`, 'g');

// @handle-style social mentions (Instagram/Telegram/X/etc.) — a bare
// "@word" has no legitimate use in this platform's chat context, so this is
// safe to always mask without the false-positive risk phone/IBAN detection
// has to guard against above.
const SOCIAL_HANDLE_PATTERN = /@[a-zA-Z0-9_.]{3,30}\b/g;

// ============================================================
// EVASION-PROOF NORMALIZATION PIPELINE — a normalized-only working copy
// used purely for DETECTION, never returned to a caller as "sanitized"
// content (positions drift too much after word->digit/noise-stripping
// substitution to map back onto the original text for surgical masking).
// When detection only fires on this normalized copy — i.e. the direct
// patterns above found nothing on the raw text — the entire message is
// masked rather than attempting a partial redaction, since we can no
// longer point at exactly which substring was the problem.
// ============================================================

const GEORGIAN_DIGIT_WORDS: Record<string, string> = {
  ნოლი: '0',
  ერთი: '1',
  ორი: '2',
  სამი: '3',
  ოთხი: '4',
  ხუთი: '5',
  ექვსი: '6',
  შვიდი: '7',
  რვა: '8',
  ცხრა: '9',
};
const ENGLISH_DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const GEORGIAN_DIGIT_WORD_PATTERN = new RegExp(
  `(?<![${GEORGIAN_LETTERS}])(${Object.keys(GEORGIAN_DIGIT_WORDS).join('|')})(?![${GEORGIAN_LETTERS}])`,
  'g'
);
const ENGLISH_DIGIT_WORD_PATTERN = new RegExp(`\\b(${Object.keys(ENGLISH_DIGIT_WORDS).join('|')})\\b`, 'gi');

function verbalNumbersToDigits(text: string): string {
  let result = text.replace(GEORGIAN_DIGIT_WORD_PATTERN, (match) => GEORGIAN_DIGIT_WORDS[match]);
  result = result.replace(ENGLISH_DIGIT_WORD_PATTERN, (match) => ENGLISH_DIGIT_WORDS[match.toLowerCase()]);
  return result;
}

// Collapses noise separators sitting BETWEEN two digits — "5 9 9 . 1 2 - 3"
// becomes "599123" (the lookahead is zero-width, so the next match attempt
// starts right at the following digit, and repeated matches within one
// .replace() pass fully collapse a whole run) — verified directly against
// "5 9 9 1 2 3 4 5 6", "5-99-123-456", and "5.9.9.1.2.3.4.5.6" all
// producing "599123456". Separators between non-digit words are untouched.
function collapseDigitNoise(text: string): string {
  return text.replace(/(\d)[\s.\-_*/]+(?=\d)/g, '$1');
}

function normalizeForEvasionDetection(text: string): string {
  return collapseDigitNoise(verbalNumbersToDigits(text));
}

// Georgian mobile numbers are 9 digits starting with 5 (5XX XXX XXX);
// international E.164 numbers run 7-15 digits. Same digit-count heuristic
// as isLikelyPhoneNumber below, just applied to a normalized candidate that
// may have started out as words and punctuation rather than raw digits.
function containsNormalizedPhoneNumber(normalized: string): boolean {
  const candidates = normalized.match(/\d{7,15}/g) ?? [];
  return candidates.length > 0;
}

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

  const latinContact = maskAll(sanitized, LATIN_CONTACT_PATTERN);
  sanitized = latinContact.text;
  wasFiltered = wasFiltered || latinContact.matched;

  const georgianContact = maskAll(sanitized, GEORGIAN_CONTACT_PATTERN);
  sanitized = georgianContact.text;
  wasFiltered = wasFiltered || georgianContact.matched;

  const handles = maskAll(sanitized, SOCIAL_HANDLE_PATTERN);
  sanitized = handles.text;
  wasFiltered = wasFiltered || handles.matched;

  // Evasion check runs last and only matters if the direct passes above
  // found nothing — if they already caught something, wasFiltered is
  // already true and severity is decided below regardless. Deliberately
  // NOT "did normalization change anything" — an innocent sentence using
  // the word "one" or "ერთი" normalizes to a lone stray digit too, and that
  // alone must never trip this. Only a normalized text that reveals a
  // genuine 7-15 digit run the ORIGINAL text didn't already have counts —
  // that's specifically what verbal-number-spelled or noise-separated phone
  // evasion produces, and a single incidental number word can't reach a
  // 7-digit run on its own.
  const normalized = normalizeForEvasionDetection(text);
  const evasionDetected = !wasFiltered && containsNormalizedPhoneNumber(normalized) && !containsNormalizedPhoneNumber(text);
  if (evasionDetected) {
    wasFiltered = true;
    sanitized = MASK; // can't point at a specific substring post-normalization — mask the whole message
  }

  // .test() on a shared module-level /g regex advances its lastIndex, which
  // would corrupt the NEXT call's match if left in place — reset both
  // before and after so this function stays safely reentrant/concurrent.
  LATIN_PAYMENT_PATTERN.lastIndex = 0;
  GEORGIAN_PAYMENT_PATTERN.lastIndex = 0;
  const paymentTermMatched = LATIN_PAYMENT_PATTERN.test(text) || GEORGIAN_PAYMENT_PATTERN.test(text);
  LATIN_PAYMENT_PATTERN.lastIndex = 0;
  GEORGIAN_PAYMENT_PATTERN.lastIndex = 0;

  const severity: ChatFlagSeverity = phone.matched || paymentTermMatched || evasionDetected ? 'HIGH' : 'MEDIUM';

  return { sanitized, wasFiltered, severity };
}
