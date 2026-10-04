// ============================================================
// IMIAKO BEGINNER LEARNING PATH — curated, deterministic curriculum for a
// true zero-beginner (A0/A1-start) student, served instead of letting a
// brand-new learner land directly on englishTutorService.ts's free-form
// AI-generated READING/VOCABULARY lessons (which assume the student can
// already read a 120-300 word passage or digest 5-12 unrelated words at
// once — the exact mismatch that produced the reported "A1 start got an
// airport passage" symptom).
//
// Deliberately NOT AI-generated: this is fixed, hand-authored content (like
// LEARNING_GOAL_CONTEXT in englishTutorService.ts is fixed data, not a
// prompt), for three reasons — (1) a true beginner's very first words must
// be exactly right every time, not re-rolled per request; (2) it costs zero
// AI/TTS spend; (3) "mastery" (routes/englishTutorBeginnerPath via
// UserTutorBeginnerProgress) can only be tracked meaningfully against a
// known, stable set of concepts, not a different AI-generated set each
// time. Stages 3-8 from the product spec (personal info, numbers, objects,
// family, actions, questions) are a content-authoring follow-up using this
// exact same engine — the engine itself (block types, mastery, audio,
// personalization, writing checks) is complete for all of them.
//
// Translations/IPA below are a small, curated, hand-checked set for CDC's
// existing native-language options (see Frontend's
// data/tutorSupportLanguages.ts) — common classroom-level greetings/
// pronouns only, chosen specifically to keep hallucination risk near zero
// (these are not novel claims, they're standard textbook phrases). Any
// nativeLang outside this curated set falls back to English rather than
// inventing a translation — see translateFor()'s own comment.
//
// Russian is deliberately NOT a curated language — platform-wide policy
// (2026-10): CDC does not offer Russian as a selectable explanation
// language anywhere, including here. A `ru`/"Russian" nativeLang is
// rejected before it ever reaches this file — see routes/englishTutor.ts's
// sanitizeNativeLang(), which maps it to English ahead of every call site
// below.
// ============================================================

export type BeginnerBlockType =
  | 'GREETING'
  | 'WORD'
  | 'SENTENCE'
  | 'GRAMMAR_TIP'
  | 'QUESTION_NAME'
  | 'PERSONAL_SENTENCE'
  | 'WRITE'
  | 'MINI_DIALOGUE'
  | 'CHECKPOINT';

// Curated native-support-language codes this file has real translations
// for — matches data/tutorSupportLanguages.ts exactly (every selectable
// code). Anything else (a learner who typed a nativeLang this table
// doesn't cover, including a rejected "ru" that sanitizeNativeLang already
// mapped to "en" before this is ever reached) gets the English fallback,
// never a fabricated guess.
const CURATED_LANGS = ['ka', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'] as const;
type CuratedLang = (typeof CURATED_LANGS)[number];
function isCuratedLang(lang: string): lang is CuratedLang {
  return (CURATED_LANGS as readonly string[]).includes(lang);
}

// Phrase-id -> { lang -> translation }. Small and hand-checked on purpose —
// see this file's header comment. "en" is always itself (never translated).
const TRANSLATIONS: Record<string, Partial<Record<CuratedLang, string>>> = {
  hello: { ka: 'გამარჯობა', de: 'Hallo', es: 'Hola', fr: 'Bonjour', uk: 'Привіт', tr: 'Merhaba', hy: 'Բարև', az: 'Salam' },
  hi: { ka: 'გამარჯობა', de: 'Hi', es: 'Hola', fr: 'Salut', uk: 'Привіт', tr: 'Selam', hy: 'Բարև', az: 'Salam' },
  'good-morning': { ka: 'დილა მშვიდობისა', de: 'Guten Morgen', es: 'Buenos días', fr: 'Bonjour', uk: 'Доброго ранку', tr: 'Günaydın', hy: 'Բարի լույս', az: 'Sabahınız xeyir' },
  goodbye: { ka: 'ნახვამდის', de: 'Auf Wiedersehen', es: 'Adiós', fr: 'Au revoir', uk: 'До побачення', tr: 'Hoşça kal', hy: 'Ցտեսություն', az: 'Sağol' },
  i: { ka: 'მე', de: 'ich', es: 'yo', fr: 'je', uk: 'я', tr: 'ben', hy: 'ես', az: 'mən' },
  am: { ka: 'ვარ', de: 'bin', es: 'soy', fr: 'suis', uk: '(ø)', tr: '-im', hy: 'եմ', az: '-am' },
  name: { ka: 'სახელი', de: 'Name', es: 'nombre', fr: 'nom', uk: "ім'я", tr: 'ad', hy: 'անուն', az: 'ad' },
  'my-name-is': { ka: 'ჩემი სახელია...', de: 'Mein Name ist...', es: 'Me llamo...', fr: "Je m'appelle...", uk: 'Мене звати...', tr: 'Benim adım...', hy: 'Իմ անունն է...', az: 'Mənim adım...' },
  'what-is-your-name': { ka: 'რა გქვია?', de: 'Wie heißt du?', es: '¿Cómo te llamas?', fr: "Comment tu t'appelles?", uk: 'Як тебе звати?', tr: 'Adın ne?', hy: 'Քո անունը ինչ է?', az: 'Sənin adın nədir?' },
  'nice-to-meet-you': { ka: 'სასიხარულოა შენი გაცნობა', de: 'Schön, dich kennenzulernen', es: 'Mucho gusto', fr: 'Enchanté(e)', uk: 'Приємно познайомитися', tr: 'Tanıştığımıza memnun oldum', hy: 'Հաճելի է ծանոթանալ', az: 'Tanış olmağıma şadam' },
};

// Never fabricates: an uncurated nativeLang (or a phraseId this table
// doesn't have yet) returns the English text itself rather than a guess —
// same "omit rather than invent" posture the product spec asks for IPA.
export function translateFor(phraseId: string, englishText: string, nativeLang: string): string {
  const normalized = nativeLang.trim().toLowerCase();
  if (!isCuratedLang(normalized)) return englishText;
  return TRANSLATIONS[phraseId]?.[normalized] ?? englishText;
}

export interface BeginnerVocabItem {
  word: string;
  ipa: string;
  exampleSentenceEn: string;
}

// Curated IPA — standard, widely-published GenAm transcriptions for common
// words, never AI-generated (see file header). Keyed by the same phraseId
// used in TRANSLATIONS above.
const VOCAB: Record<string, BeginnerVocabItem> = {
  hello: { word: 'Hello', ipa: '/həˈloʊ/', exampleSentenceEn: 'Hello, I am IMIAKO.' },
  hi: { word: 'Hi', ipa: '/haɪ/', exampleSentenceEn: 'Hi! Nice to meet you.' },
  'good-morning': { word: 'Good morning', ipa: '/ɡʊd ˈmɔːrnɪŋ/', exampleSentenceEn: 'Good morning! How are you?' },
  goodbye: { word: 'Goodbye', ipa: '/ɡʊdˈbaɪ/', exampleSentenceEn: 'Goodbye! See you soon.' },
  i: { word: 'I', ipa: '/aɪ/', exampleSentenceEn: 'I am a student.' },
  am: { word: 'am', ipa: '/æm/', exampleSentenceEn: 'I am happy.' },
  name: { word: 'name', ipa: '/neɪm/', exampleSentenceEn: 'My name is Nino.' },
};

export type BeginnerBlock =
  | { type: 'GREETING'; id: string; textEn: string; translationKey?: string }
  | { type: 'WORD'; id: string; vocabId: string }
  | { type: 'SENTENCE'; id: string; textEn: string; translationKey?: string }
  | { type: 'GRAMMAR_TIP'; id: string; titleEn: string; translationKey: string; examplesEn: string[] }
  | { type: 'QUESTION_NAME'; id: string; promptEn: string; translationKey: string }
  | { type: 'PERSONAL_SENTENCE'; id: string; templateEn: string } // "{name}" substituted server-side
  | {
      type: 'WRITE';
      id: string;
      instructionEn: string;
      translationKey: string;
      expectedTemplateEn: string; // server-only — never serialized to the client, see routes/englishTutor.ts's serializeBeginnerBlock
      // What to actually play back for a "listen, then write" task — a
      // separate field from expectedTemplateEn (even though they're often
      // the same word) so a future WRITE block that ISN'T a pure
      // listen-and-transcribe task (e.g. "write it yourself" right after a
      // PERSONAL_SENTENCE the learner already saw/heard) can omit this and
      // rely on what was already shown, without exposing the answer twice.
      audioTextEn?: string;
    }
  | { type: 'MINI_DIALOGUE'; id: string; turns: { speaker: 'IMIAKO' | 'LEARNER'; textEn: string }[] }
  | { type: 'CHECKPOINT'; id: string; titleEn: string; translationKey: string };

export interface BeginnerStage {
  id: string;
  nextStageId: string | null;
  blocks: BeginnerBlock[];
}

// Stage 1 — Greetings (product spec section 2, Stage 1).
const GREETINGS_STAGE: BeginnerStage = {
  id: 'greetings',
  nextStageId: 'introductions',
  blocks: [
    { type: 'GREETING', id: 'greet:wave', textEn: '👋 Hello!' },
    { type: 'WORD', id: 'word:hello', vocabId: 'hello' },
    { type: 'WORD', id: 'word:hi', vocabId: 'hi' },
    { type: 'WORD', id: 'word:good-morning', vocabId: 'good-morning' },
    { type: 'WORD', id: 'word:goodbye', vocabId: 'goodbye' },
    {
      type: 'WRITE',
      id: 'write:hello',
      instructionEn: 'Listen, then write the word you heard.',
      translationKey: 'writeListened',
      expectedTemplateEn: 'Hello',
      audioTextEn: 'Hello',
    },
    { type: 'CHECKPOINT', id: 'checkpoint:greetings', titleEn: 'Great job! You know how to greet someone in English.', translationKey: 'checkpointGreetings' },
  ],
};

// Stage 2 — Introducing yourself (product spec section 2, Stage 2; also
// the exact worked example in section 14 of the spec).
const INTRODUCTIONS_STAGE: BeginnerStage = {
  id: 'introductions',
  nextStageId: null, // stages 3-8 are a content-authoring follow-up — see file header
  blocks: [
    { type: 'SENTENCE', id: 'sentence:i-am-imiako', textEn: 'I am IMIAKO.' },
    { type: 'WORD', id: 'word:i', vocabId: 'i' },
    { type: 'WORD', id: 'word:am', vocabId: 'am' },
    {
      type: 'GRAMMAR_TIP',
      id: 'grammar:i-am',
      titleEn: 'I am',
      translationKey: 'grammarIAm',
      examplesEn: ['I am Nino.', 'I am a student.', 'I am happy.'],
    },
    { type: 'QUESTION_NAME', id: 'question:name', promptEn: 'What is your name?', translationKey: 'what-is-your-name' },
    { type: 'PERSONAL_SENTENCE', id: 'personal:i-am-name', templateEn: 'I am {name}.' },
    {
      type: 'WRITE',
      id: 'write:i-am-name',
      instructionEn: 'Now write it yourself.',
      translationKey: 'writeItYourself',
      expectedTemplateEn: 'I am {name}.',
    },
    { type: 'WORD', id: 'word:name', vocabId: 'name' },
    { type: 'PERSONAL_SENTENCE', id: 'personal:my-name-is', templateEn: 'My name is {name}.' },
    {
      type: 'WRITE',
      id: 'write:my-name-is',
      instructionEn: 'Write this sentence.',
      translationKey: 'writeThisSentence',
      expectedTemplateEn: 'My name is {name}.',
    },
    {
      type: 'MINI_DIALOGUE',
      id: 'dialogue:introduce-self',
      turns: [
        { speaker: 'IMIAKO', textEn: 'Hello! What is your name?' },
        { speaker: 'LEARNER', textEn: 'My name is {name}.' },
      ],
    },
    { type: 'CHECKPOINT', id: 'checkpoint:introductions', titleEn: 'Wonderful! You can introduce yourself in English.', translationKey: 'checkpointIntroductions' },
  ],
};

const STAGES: Record<string, BeginnerStage> = {
  greetings: GREETINGS_STAGE,
  introductions: INTRODUCTIONS_STAGE,
};

export const FIRST_STAGE_ID = 'greetings';

export function getStage(stageId: string): BeginnerStage | null {
  return STAGES[stageId] ?? null;
}

export function getVocabItem(vocabId: string): BeginnerVocabItem | null {
  return VOCAB[vocabId] ?? null;
}

// Fills a "{name}" template with the learner's own chosen display name —
// the one bit of real personalization this path does (product spec
// sections 1/12/14). Trims/collapses whitespace defensively; the actual
// validation (non-empty, max length) lives in the route's zod schema.
export function applyLearnerName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.trim());
}

// Deterministic, server-side correctness check for a WRITE block — never an
// AI call (there is exactly one correct answer for fixed curriculum
// content, unlike englishTutorService's free-text WRITING/DIALOGUE
// grading). Case/whitespace/terminal-punctuation-insensitive so "hello",
// "Hello", and "hello " all count — a true beginner's very first typing
// attempt should not fail on a trailing space or missing period.
export function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

export function isWriteAnswerCorrect(expectedTemplate: string, learnerName: string | null, submitted: string): boolean {
  const expected = learnerName ? applyLearnerName(expectedTemplate, learnerName) : expectedTemplate;
  return normalizeForComparison(expected) === normalizeForComparison(submitted);
}
