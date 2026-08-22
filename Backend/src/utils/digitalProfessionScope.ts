// ============================================================
// Digital/tech domain gate for the freelancer skill exam's free-typed
// "Other profession" field (routes/freelancerExam.ts) — CDC only verifies
// digital and technology skills, so a custom profession outside that scope
// (plumber, chef, driver, ...) should never reach the AI question
// generator at all, not just fail to produce good questions for it.
//
// Deliberately a plain keyword allow-list, not an AI classification call —
// this gate has to be a synchronous, deterministic yes/no with no network
// round trip, no cost, and no chance of a model hallucinating a wrong
// answer for the one check whose whole job is saying "no". An allow-list
// (rather than trying to enumerate every non-digital job) matches the
// actual requirement: digital/tech is the narrow, well-defined category
// here, everything else is the default.
//
// Deliberately over-inclusive at the margins (e.g. "photographer",
// "video editor") rather than under — the real damage from a false
// positive here is a slightly-too-generous exam topic; the real damage
// from a false negative is rejecting a legitimate digital freelancer's
// verification attempt outright.
// ============================================================

// Long enough (or specific enough multi-word phrases) that a plain
// substring match carries negligible false-positive risk — e.g. no
// unrelated English profession name happens to contain "developer" or
// "video edit" as a substring.
const SUBSTRING_KEYWORDS = [
  'developer', 'programmer', 'software', 'engineer', 'devops', 'backend', 'frontend', 'full stack', 'fullstack',
  'tester', 'testing', 'cloud', 'cyber', 'security', 'network', 'database', 'sysadmin',
  'დეველოპერ', 'პროგრამისტ', 'პროგრამულ', 'ინჟინერ', 'ტესტერ', 'ღრუბლოვან', 'ქსელ', 'მონაცემთა ბაზ', 'კიბერ',
  'design', 'designer', 'illustrat', 'animat', 'graphic', 'branding', 'brand', 'interior', 'video edit', 'photo edit',
  'დიზაინ', 'ილუსტრატორ', 'ანიმაცი', 'ბრენდ', 'ინტერიერ', 'ვიდეო მონტაჟ', 'ფოტო რედაქტ',
  'marketing', 'copywrit', 'content', 'social media', 'analytics', 'analyst', 'data', 'growth',
  'მარკეტინგ', 'კოპირაიტ', 'კონტენტ', 'ანალიტიკ', 'ანალიტიკოს', 'მონაცემ',
  'artificial intelligence', 'machine learning', 'prompt', 'digital', 'technology', 'technical',
  'product manager', 'application',
  'ხელოვნური ინტელექტ', 'პრომპტ', 'ციფრულ', 'ტექნოლოგ', 'ვები', 'პროდუქტ მენეჯერ', 'აპლიკაცი',
];

// Short and/or generic enough (2-4 characters, or a common English word
// stem) that a plain substring match produces real false positives —
// confirmed by test: 'ai'/'it' as bare substrings matched "aircraft
// mechanic" and "portrait photographer"; 'tech' matched "nail technician"
// and "air conditioning technician" (any *-technician, not just IT ones);
// 'motion' matched "emotional support counselor" and "promotion
// specialist" via emotion/promotion. Matched only as a whole word (regex
// \b...\b) instead — "AI Engineer"/"IT Support"/"Tech Lead"/"Motion
// Designer" still match; "aircraft", "technician", "emotional" don't,
// since those are different whole words, not the token itself.
// Deliberately English-only: JS regex \b is defined in terms of \w
// ([A-Za-z0-9_]), so it does not reliably bound Georgian script — the
// Georgian keywords above are long/specific multi-character stems instead,
// where substring collision risk is negligible in the first place.
const WORD_BOUNDARY_KEYWORDS = ['ai', 'it', 'ux', 'ui', 'qa', 'sql', 'web', 'tech', 'seo', 'smm', '3d', 'motion'];
const wordBoundaryPattern = new RegExp(`\\b(${WORD_BOUNDARY_KEYWORDS.join('|')})\\b`, 'i');

export function isDigitalProfession(profession: string): boolean {
  const trimmed = profession.trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (SUBSTRING_KEYWORDS.some((keyword) => normalized.includes(keyword))) return true;
  return wordBoundaryPattern.test(trimmed);
}

export const OUT_OF_SCOPE_MESSAGE: Record<'ka' | 'en', string> = {
  ka: 'უნარების შემოწმება ხდება მხოლოდ ციფრულ და ტექნოლოგიურ პროფესიებში. აღნიშნული სფერო არ შედის CDC-ის კომპეტენციაში.',
  en: "Skills verification is only available for digital and tech professions. The specified field falls outside CDC's scope.",
};
