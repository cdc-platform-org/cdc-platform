// Client-side mirror of Backend/src/utils/sanitizeChatMessage.ts — gives the
// sender instant feedback on what will be masked, but is NOT the real
// enforcement. The server re-runs the same logic on every message before
// storing it, since a client-only filter can always be bypassed by whoever
// controls the client (e.g. calling the API directly).

export type ChatFlagSeverity = 'MEDIUM' | 'HIGH';

export interface SanitizeChatMessageResult {
  sanitized: string;
  wasFiltered: boolean;
  severity: ChatFlagSeverity;
}

const MASK = '[BLOCKED FOR SAFETY]';

const GEORGIAN_LETTERS = '\\u10A0-\\u10FF';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IBAN_PATTERN = /\b[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}\b/g;

const PHONE_CANDIDATE_PATTERN = /(\+?\d[\d\-.\s()]{5,}\d)/g;

const LATIN_PLATFORM_TERMS = ['whats ?app', 'wa\\.me', 'telegram', 't\\.me', 'viber', 'messenger', 'signal', 'skype', 'instagram', 'insta\\b'];
const LATIN_PAYMENT_TERMS = ['tbc transfer', 'tbc(?!\\w)', 'direct transfer', 'bank transfer', 'bog transfer', 'card transfer', 'cash payment', 'off[- ]?platform'];
const LATIN_CONTACT_PATTERN = new RegExp(`\\b(${[...LATIN_PLATFORM_TERMS, ...LATIN_PAYMENT_TERMS].join('|')})\\b`, 'gi');
const LATIN_PAYMENT_PATTERN = new RegExp(`\\b(${LATIN_PAYMENT_TERMS.join('|')})\\b`, 'gi');

const GEORGIAN_PLATFORM_STEMS = ['ვაცაპ', 'ვაწაპ', 'ტელეგრამ', 'თელეგრამ', 'ვაიბერ', 'ინსტაგრამ'];
const GEORGIAN_PAYMENT_STEMS = ['ბარათ', 'ანგარიშ', 'ქარდ', 'ბანკის გადარიცხვ', 'ბოგ(ის)? გადარიცხვ', 'გარეთ'];
const GEORGIAN_CONTACT_PATTERN = new RegExp(
  `(?<![${GEORGIAN_LETTERS}])(${[...GEORGIAN_PLATFORM_STEMS, ...GEORGIAN_PAYMENT_STEMS].join('|')})[${GEORGIAN_LETTERS}]{0,4}`,
  'g'
);
const GEORGIAN_PAYMENT_PATTERN = new RegExp(`(?<![${GEORGIAN_LETTERS}])(${GEORGIAN_PAYMENT_STEMS.join('|')})[${GEORGIAN_LETTERS}]{0,4}`, 'g');

const SOCIAL_HANDLE_PATTERN = /@[a-zA-Z0-9_.]{3,30}\b/g;

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

function collapseDigitNoise(text: string): string {
  return text.replace(/(\d)[\s.\-_*/]+(?=\d)/g, '$1');
}

function normalizeForEvasionDetection(text: string): string {
  return collapseDigitNoise(verbalNumbersToDigits(text));
}

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

  const normalized = normalizeForEvasionDetection(text);
  const evasionDetected = !wasFiltered && containsNormalizedPhoneNumber(normalized) && !containsNormalizedPhoneNumber(text);
  if (evasionDetected) {
    wasFiltered = true;
    sanitized = MASK;
  }

  LATIN_PAYMENT_PATTERN.lastIndex = 0;
  GEORGIAN_PAYMENT_PATTERN.lastIndex = 0;
  const paymentTermMatched = LATIN_PAYMENT_PATTERN.test(text) || GEORGIAN_PAYMENT_PATTERN.test(text);
  LATIN_PAYMENT_PATTERN.lastIndex = 0;
  GEORGIAN_PAYMENT_PATTERN.lastIndex = 0;

  const severity: ChatFlagSeverity = phone.matched || paymentTermMatched || evasionDetected ? 'HIGH' : 'MEDIUM';

  return { sanitized, wasFiltered, severity };
}
