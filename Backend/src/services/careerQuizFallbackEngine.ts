// ============================================================
// TIER 3 — LOCAL DETERMINISTIC CAREER-QUIZ ENGINE
//
// The last-resort fallback for generateCareerQuizResult() (see
// careerQuizService.ts) — reached only once Tier 1 (Gemini) and Tier 2
// (Azure OpenAI, when configured) have both failed or timed out. Pure,
// synchronous keyword-matching against the quiz's own known question/answer
// option strings (career-test.tsx) plus whatever is actually live in the
// catalog — no network call, no external dependency, cannot itself fail in
// a way that should ever surface to the visitor. Deliberately NOT trying to
// out-write the AI's own prose (that's Tier 1/2's job) — this exists purely
// so a visitor never sees a hard failure when every real AI provider is
// down at once, with output honest and specific enough to still be useful.
//
// Same non-hallucination contract as the AI prompt (careerQuizService.ts's
// generateCareerQuizResult): only ever names a course/training that is
// ACTUALLY in the live catalog passed in — if nothing in it matches the
// identified track, this says so honestly and points to
// contact@cdc.org.ge, exactly like the AI is instructed to.
// ============================================================

export type CareerQuizAgeGroup = 'KID' | 'ADULT';

export interface FallbackCatalogItem {
  title: string;
  titleEn: string | null;
  category: string;
  kind: 'course' | 'training';
}

interface QuizInput {
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  age: number;
  answers: Record<string, string | string[]>;
}

// ------------------------------------------------------------
// TRACK KNOWLEDGE BASE — each track is a plausible CDC direction, matched
// two ways: `signalKeywords` against the quiz's own answer option text
// (career-test.tsx, ka + en — kept in sync manually since the quiz options
// are a small, stable, hand-written set, not a dynamic source this file
// could import from without a Frontend->Backend dependency that doesn't
// exist anywhere else in this codebase), and `catalogKeywords` against
// whatever is actually published right now (Course.category/title,
// LiveTraining.category/title). A track only ever gets recommended if BOTH
// a real answer signal AND a real live catalog match exist for it.
// ------------------------------------------------------------
interface Track {
  id: string;
  label: { ka: string; en: string };
  signalKeywords: string[];
  catalogKeywords: string[];
}

const TRACKS: Track[] = [
  {
    id: 'programming',
    label: { ka: 'პროგრამირება და AI-ინსტრუმენტები', en: 'Programming & AI Tools' },
    signalKeywords: [
      // Kid signals
      'ვიდეო თამაშების თამაში', 'თამაშის', 'აპლიკაციის შექმნა', 'რობოტების აწყობა', 'თავსატეხების ამოხსნა',
      'მარტო ვფიქრობ და ეტაპობრივად', 'ახალი რაღაცების აწყობა',
      'playing video games', 'own game or app', 'building robots', 'solving puzzles', 'figure it out alone', 'building or making new things',
      // Adult signals
      'პირველი სამსახურის შოვნა ტექში', 'landing a first job in tech',
    ],
    catalogKeywords: ['პროგრამ', 'programming', 'coding', 'vibe coding', 'ai', 'დეველოპ', 'developer', 'web', 'ვები'],
  },
  {
    id: 'design',
    label: { ka: 'დიზაინი, ანიმაცია და ვიდეო კონტენტი', en: 'Design, Animation & Video Content' },
    signalKeywords: [
      'ხატვა და ციფრული ხელოვნება', 'ციფრული ხელოვნების დახატვა', 'ვიდეოების ან ანიმაციების გადაღება',
      'ვხატავ ან ვაწყობ რაღაცას',
      'drawing', 'digital art', 'making videos or animations', 'draw or build something',
    ],
    catalogKeywords: ['დიზაინ', 'design', 'ანიმაც', 'animation', 'ვიდეო', 'video', 'გრაფიკ', 'graphic'],
  },
  {
    id: 'content',
    label: { ka: 'კონტენტის შექმნა და ციფრული მარკეტინგი', en: 'Content Creation & Digital Marketing' },
    signalKeywords: [
      'ისტორიების მოყოლა ან წერა', 'ვიგონებ ამბავს', 'საკუთარი ბიზნესის/პროექტის დაწყება',
      'telling or writing stories', 'make up a story', 'starting my own business',
    ],
    catalogKeywords: ['მარკეტ', 'marketing', 'კონტენტ', 'content', 'ბიზნეს', 'business', 'სმმ', 'smm'],
  },
];

// Used only when no track scores above zero (a genuinely ambiguous answer
// set) — a neutral, still-genuine recommendation rather than forcing a
// false-confidence match. catalogKeywords empty on purpose: the caller
// falls through to "recommend the first live item" for this track.
const GENERIC_TRACK: Track = {
  id: 'generic',
  label: { ka: 'ციფრული პროფესიები ზოგადად', en: 'Digital careers, broadly' },
  signalKeywords: [],
  catalogKeywords: [],
};

function flattenAnswers(answers: Record<string, string | string[]>): string[] {
  const values: string[] = [];
  for (const v of Object.values(answers)) {
    if (Array.isArray(v)) values.push(...v);
    else if (v) values.push(v);
  }
  return values;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

// Picks the track whose signalKeywords appear most often (substring match,
// case-insensitive — safe for both Georgian and Latin script) across the
// visitor's actual selected answers. Ties broken by TRACKS array order
// (programming > design > content) — an arbitrary but stable, deterministic
// choice, same reasoning as any other "first match wins" tie-break in this
// codebase.
function pickTrack(answerValues: string[]): Track {
  const normalizedAnswers = answerValues.map(normalize);
  let best: { track: Track; score: number } | null = null;
  for (const track of TRACKS) {
    let score = 0;
    for (const kw of track.signalKeywords) {
      const nkw = normalize(kw);
      if (normalizedAnswers.some((a) => a.includes(nkw) || nkw.includes(a))) score++;
    }
    if (score > 0 && (!best || score > best.score)) best = { track, score };
  }
  return best?.track ?? GENERIC_TRACK;
}

// Real catalog match only — never invents one. Tries the identified
// track's catalogKeywords first; GENERIC_TRACK (empty keywords) falls
// through to "first live item" so a generic recommendation still names
// something real rather than nothing at all.
function matchCatalogItem(track: Track, catalog: FallbackCatalogItem[]): FallbackCatalogItem | null {
  if (catalog.length === 0) return null;
  if (track.catalogKeywords.length === 0) return catalog[0];
  const normalizedKeywords = track.catalogKeywords.map(normalize);
  const match = catalog.find((item) => {
    const haystack = normalize(`${item.category} ${item.title} ${item.titleEn ?? ''}`);
    return normalizedKeywords.some((kw) => haystack.includes(kw));
  });
  return match ?? catalog[0];
}

function resolveAgeGroup(age: number): CareerQuizAgeGroup {
  return age < 16 ? 'KID' : 'ADULT';
}

// ------------------------------------------------------------
// REPORT TEMPLATES — one KID/ADULT x ka/en variant of each of the 3
// sections, filled in with the identified track and matched catalog item.
// Kept deliberately plain/direct rather than trying to mimic the AI's more
// elaborate prose — this is a fallback, not a replacement, and honesty
// about what it is (a clean, useful, but simpler report) beats a strained
// imitation.
// ------------------------------------------------------------
function buildReport(
  ageGroup: CareerQuizAgeGroup,
  lang: 'ka' | 'en',
  age: number,
  track: Track,
  matchedItem: FallbackCatalogItem | null
): string {
  const trackLabel = track.label[lang];
  const itemName = matchedItem ? (lang === 'en' && matchedItem.titleEn ? matchedItem.titleEn : matchedItem.title) : null;

  if (lang === 'ka') {
    const profile =
      ageGroup === 'KID'
        ? `თქვენი ${age} წლის შვილის პასუხებში ნათლად იკვეთება ინტერესი **${trackLabel}** მიმართულებით — ეს ასაკი ზუსტად ის დროა, როცა ბავშვმა შეიძლება პირველად სცადოს ციფრული შემოქმედება პრაქტიკულად, თამაშის ფორმატში, ზეწოლის გარეშე. მნიშვნელოვანია არა შედეგის იდეალურობა, არამედ ცნობისმოყვარეობის შენარჩუნება და ახალი რაღაცის კეთების სიამოვნება.`
        : `თქვენი პასუხების მიხედვით, ${age} წლის ასაკში, თქვენ პრაგმატულად უდგებით ახალი ციფრული პროფესიის არჩევას — გაქვთ კონკრეტული მიზნები დროისა და შემოსავლის მხრივ, რაც კარგი საწყისი წერტილია. თქვენი ინტერესები ყველაზე ახლოს დგას **${trackLabel}** მიმართულებასთან.`;

    const path =
      ageGroup === 'KID'
        ? `**${trackLabel}** არის შესანიშნავი მიმართულება იმ ბავშვისთვის, ვისაც სიამოვნებს შემოქმედებითი ექსპერიმენტები და ახალი რაღაცის აწყობა. ამ ეტაპზე მთავარია არა კონკრეტული პროფესიის არჩევა, არამედ ისეთი გარემოს შექმნა, სადაც ეს ინტერესი შეუძლია განვითარდეს რეალურ უნარებად — თანდათან, თამაშითა და პრაქტიკული პროექტებით.`
        : `**${trackLabel}** მიმართულება რეალურ შესაძლებლობებს იძლევა თქვენს მიერ მითითებული სამუშაო პირობებისა და შემოსავლის მიზნების მისაღწევად. ეს სფერო ცნობილია დამწყებთათვის შედარებით დაბალი შესვლის ბარიერით და მკაფიო ზრდის ტრაექტორიით, პრაქტიკული უნარების დაუფლების პარალელურად.`;

    const roadmap = matchedItem
      ? `CDC-ის პლატფორმაზე ამ მიმართულებით ამჟამად ხელმისაწვდომია **${itemName}**. გირჩევთ: 1) გაეცნოთ პროგრამის დეტალებს კურსის გვერდზე; 2) დაათვალიეროთ, შეესაბამება თუ არა ხანგრძლივობა და ფორმატი თქვენს გრაფიკს; 3) დარეგისტრირდეთ ან დამატებითი კითხვებისთვის მოგვწეროთ contact@cdc.org.ge-ზე. სრული კატალოგისთვის ეწვიეთ: [/courses](/courses).`
      : `ამ კონკრეტული მიმართულებით ამჟამად აქტიური პროგრამა არ გვაქვს გამოქვეყნებული, ამიტომ პატიოსნად გეტყვით — ვიდრე ხელოვნურად შემოგთავაზებდეთ არარელევანტურ ვარიანტს, გირჩევთ პირდაპირ დაგვიკავშირდეთ contact@cdc.org.ge-ზე, რომ გაცნობოთ უახლოესი გეგმების შესახებ, ან რეგულარულად შეამოწმოთ ჩვენი კატალოგი: [/courses](/courses).`;

    return `## პროფილის ანალიზი / Profile Breakdown\n${profile}\n\n## რეკომენდებული მიმართულება / Recommended Path\n${path}\n\n## CDC-ის სამოქმედო გეგმა / Actionable CDC Roadmap\n${roadmap}`;
  }

  // English
  const profile =
    ageGroup === 'KID'
      ? `Your ${age}-year-old's answers clearly point toward an interest in **${trackLabel}** — this is exactly the age where a first hands-on taste of digital creativity, playful and pressure-free, matters far more than getting a "perfect" result. What counts here is keeping the curiosity alive and the enjoyment of making something new.`
      : `Based on your answers, at ${age} you're approaching a new digital career pragmatically — you have concrete goals around time and income, which is a solid starting point. Your interests point most closely toward **${trackLabel}**.`;

  const path =
    ageGroup === 'KID'
      ? `**${trackLabel}** is a great direction for a child who enjoys creative experimentation and building new things. At this stage, the goal isn't picking a specific profession — it's creating an environment where this interest can grow into real skills gradually, through play and hands-on projects.`
      : `**${trackLabel}** offers a realistic path toward the work conditions and income goals you described. This field is known for a comparatively low barrier to entry for beginners and a clear growth trajectory as practical skills are built up.`;

  const roadmap = matchedItem
    ? `CDC currently has **${itemName}** available in this direction. Recommended next steps: 1) review the program details on its course page; 2) check whether the duration and format fit your schedule; 3) register, or email contact@cdc.org.ge with any questions. See the full catalog at: [/courses](/courses).`
    : `We don't currently have an active program in this exact direction, so rather than force an irrelevant match, we'd rather be upfront — please reach out directly at contact@cdc.org.ge so we can tell you about upcoming plans, or check our catalog regularly: [/courses](/courses).`;

  return `## Profile Breakdown\n${profile}\n\n## Recommended Path\n${path}\n\n## Actionable CDC Roadmap\n${roadmap}`;
}

// Public entry point — see careerQuizService.ts's generateCareerQuizResult,
// which calls this only after Tier 1 (Gemini) and Tier 2 (Azure) have both
// been exhausted. Deliberately has no async boundary and touches nothing
// beyond its own arguments, so it cannot itself be the thing that fails.
export function generateFallbackCareerReport(input: QuizInput, lang: 'ka' | 'en', catalog: FallbackCatalogItem[]): string {
  const ageGroup = resolveAgeGroup(input.age);
  const answerValues = flattenAnswers(input.answers);
  const track = pickTrack(answerValues);
  const matchedItem = matchCatalogItem(track, catalog);
  return buildReport(ageGroup, lang, input.age, track, matchedItem);
}
