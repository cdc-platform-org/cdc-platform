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

const DIGITAL_KEYWORDS = [
  // IT / software / engineering
  'developer', 'programmer', 'software', 'engineer', 'devops', 'backend', 'frontend', 'full stack', 'fullstack',
  'qa', 'tester', 'testing', 'cloud', 'cyber', 'security', 'network', 'database', 'sql', 'it ', 'sysadmin',
  'დეველოპერ', 'პროგრამისტ', 'პროგრამულ', 'ინჟინერ', 'ტესტერ', 'ღრუბლოვან', 'ქსელ', 'მონაცემთა ბაზ', 'კიბერ',
  // Design (incl. non-strictly-digital creative fields CDC still verifies)
  'design', 'designer', 'ux', 'ui', 'illustrat', 'animat', 'motion', '3d', 'graphic', 'branding', 'brand',
  'interior', 'video edit', 'photo edit',
  'დიზაინ', 'ილუსტრატორ', 'ანიმაცი', 'ბრენდ', 'ინტერიერ', 'ვიდეო მონტაჟ', 'ფოტო რედაქტ',
  // Marketing / content / analytics / data
  'marketing', 'copywrit', 'content', 'seo', 'smm', 'social media', 'analytics', 'analyst', 'data', 'growth',
  'მარკეტინგ', 'კოპირაიტ', 'კონტენტ', 'ანალიტიკ', 'ანალიტიკოს', 'მონაცემ',
  // AI / product / web / general "digital"
  'ai ', ' ai', 'artificial intelligence', 'machine learning', 'prompt', 'digital', 'tech', 'technology', 'web',
  'product manager', 'app ', 'application',
  'ხელოვნური ინტელექტ', 'პრომპტ', 'ციფრულ', 'ტექნოლოგ', 'ვები', 'პროდუქტ მენეჯერ', 'აპლიკაცი',
];

// Normalizes both the keyword list's implicit casing and the input —
// keywords above are already lowercase; this just does the same to
// whatever a user typed, in either script.
export function isDigitalProfession(profession: string): boolean {
  const normalized = ` ${profession.trim().toLowerCase()} `;
  if (!normalized.trim()) return false;
  return DIGITAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export const OUT_OF_SCOPE_MESSAGE: Record<'ka' | 'en', string> = {
  ka: 'უნარების შემოწმება ხდება მხოლოდ ციფრულ და ტექნოლოგიურ პროფესიებში. აღნიშნული სფერო არ შედის CDC-ის კომპეტენციაში.',
  en: "Skills verification is only available for digital and tech professions. The specified field falls outside CDC's scope.",
};
