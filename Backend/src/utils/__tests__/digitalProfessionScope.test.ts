import { isDigitalProfession, OUT_OF_SCOPE_MESSAGE } from '../digitalProfessionScope';

describe('isDigitalProfession', () => {
  describe('valid digital/tech professions', () => {
    const cases = [
      'Interior Designer',
      'Motion Designer',
      'Prompt Engineer',
      'Web Developer',
      'UI/UX Designer',
      'Digital Marketing Specialist',
      'Data Analyst',
      'Copywriter',
      'Software Engineer',
      'SEO Specialist',
      'Graphic Designer',
      'AI Engineer',
      'ვებ დეველოპერი', // "web developer" (ka)
      'გრაფიკული დიზაინერი', // "graphic designer" (ka)
      'მარკეტინგის სპეციალისტი', // "marketing specialist" (ka)
    ];
    it.each(cases)('accepts "%s"', (profession) => {
      expect(isDigitalProfession(profession)).toBe(true);
    });
  });

  describe('non-digital professions', () => {
    const cases = ['Plumber', 'Chef', 'Driver', 'Construction Worker', 'Mechanic', 'Electrician', 'Hairdresser', 'Farmer'];
    it.each(cases)('rejects "%s"', (profession) => {
      expect(isDigitalProfession(profession)).toBe(false);
    });
  });

  // Regression cases found by a QA audit probe: the short, generic tokens
  // meant for "AI"/"IT"/"Tech"/"Motion" (as standalone words, e.g. "AI
  // Engineer") were originally matched as plain substrings, which also
  // matched them mid-word inside completely unrelated professions —
  // rejecting these correctly is exactly what the digital-scope gate
  // exists for, so a regression here would silently let real non-digital
  // requests reach the AI exam generator again.
  describe('word-boundary regression cases (ai/it/tech/motion false positives)', () => {
    const cases = [
      'Aircraft Mechanic', // contains "ai" mid-word
      'Portrait Photographer', // contains "ai"/"it" mid-word
      'Wait Staff', // contains "it" mid-word
      'Nail Technician', // contains "tech" as a prefix of "technician", not the standalone word
      'Air Conditioning Technician',
      'Emotional Support Counselor', // contains "motion" mid-word ("e-MOTION-al")
      'Promotion Coordinator', // contains "motion" mid-word ("pro-MOTION")
    ];
    it.each(cases)('rejects "%s"', (profession) => {
      expect(isDigitalProfession(profession)).toBe(false);
    });

    const legitimateCases = [
      'AI Engineer',
      'IT Support Specialist',
      'Tech Lead',
      'Motion Designer',
      'UI Designer',
      'UX Researcher',
      'QA Engineer',
    ];
    it.each(legitimateCases)('still accepts "%s" as a standalone word', (profession) => {
      expect(isDigitalProfession(profession)).toBe(true);
    });
  });

  it('is case-insensitive', () => {
    expect(isDigitalProfession('WEB DEVELOPER')).toBe(true);
    expect(isDigitalProfession('plumber')).toBe(false);
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(isDigitalProfession('')).toBe(false);
    expect(isDigitalProfession('   ')).toBe(false);
  });

  it('matches a keyword appearing anywhere in a longer free-typed phrase', () => {
    expect(isDigitalProfession('Senior Backend Developer for fintech startups')).toBe(true);
    expect(isDigitalProfession('I fix cars and trucks for a living')).toBe(false);
  });
});

describe('OUT_OF_SCOPE_MESSAGE', () => {
  it('has the exact required Georgian and English wording', () => {
    expect(OUT_OF_SCOPE_MESSAGE.ka).toBe(
      'უნარების შემოწმება ხდება მხოლოდ ციფრულ და ტექნოლოგიურ პროფესიებში. აღნიშნული სფერო არ შედის CDC-ის კომპეტენციაში.'
    );
    expect(OUT_OF_SCOPE_MESSAGE.en).toBe(
      "Skills verification is only available for digital and tech professions. The specified field falls outside CDC's scope."
    );
  });
});
