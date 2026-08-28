import { isSkillNameInScope } from '../skillTests';

// Regression coverage for the digital-professions gate added to
// POST /skill-tests/generate. The core risk this guards against: naively
// gating on digitalProfessionScope.ts's tech-keyword list alone would
// reject several of CDC's own pre-approved curated skills (they don't
// literally contain a tech keyword substring) — isSkillNameInScope must
// always allow the curated list through regardless of keyword match, and
// only apply the keyword gate to free-typed "Other" entries.
describe('skillTests — isSkillNameInScope', () => {
  it('allows every curated freelancer skill, including ones with no tech keyword substring', () => {
    // These specifically do NOT match any digitalProfessionScope.ts keyword
    // on their own — confirmed by inspection before writing this gate.
    expect(isSkillNameInScope('WordPress')).toBe(true);
    expect(isSkillNameInScope('Photography')).toBe(true);
    expect(isSkillNameInScope('Mobile App Development')).toBe(true);
    expect(isSkillNameInScope('Virtual Assistance')).toBe(true);
    expect(isSkillNameInScope('Translation')).toBe(true);
  });

  it('allows a free-typed custom skill that is genuinely digital', () => {
    expect(isSkillNameInScope('UX Researcher')).toBe(true);
    expect(isSkillNameInScope('პროგრამისტი')).toBe(true);
  });

  it('rejects a free-typed non-digital physical trade — the reported bug', () => {
    expect(isSkillNameInScope('ელექტრიკი')).toBe(false);
    expect(isSkillNameInScope('Electrician')).toBe(false);
    expect(isSkillNameInScope('Plumber')).toBe(false);
  });
});
