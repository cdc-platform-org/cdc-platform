import {
  getStage,
  getVocabItem,
  translateFor,
  applyLearnerName,
  isWriteAnswerCorrect,
  normalizeForComparison,
  FIRST_STAGE_ID,
} from '../beginnerCurriculumService';

describe('beginnerCurriculumService — curriculum content', () => {
  it('FIRST_STAGE_ID resolves to a real stage with at least one block', () => {
    const stage = getStage(FIRST_STAGE_ID);
    expect(stage).not.toBeNull();
    expect(stage!.blocks.length).toBeGreaterThan(0);
  });

  it('every stage chain eventually ends (no nextStageId cycle) and never exceeds 2 stages in this phase', () => {
    const visited = new Set<string>();
    let stageId: string | null = FIRST_STAGE_ID;
    while (stageId) {
      expect(visited.has(stageId)).toBe(false); // would indicate a cycle
      visited.add(stageId);
      const stage = getStage(stageId);
      expect(stage).not.toBeNull();
      stageId = stage!.nextStageId;
    }
    expect(visited.size).toBe(2); // greetings, introductions — see file header on stages 3-8
  });

  it('a true zero-beginner never sees a long reading passage as the first block', () => {
    const stage = getStage(FIRST_STAGE_ID)!;
    const firstBlock = stage.blocks[0];
    expect(firstBlock.type).not.toBe('READING');
    expect(['GREETING', 'WORD', 'SENTENCE']).toContain(firstBlock.type);
  });

  it('every WORD block references a vocab item that actually exists, with non-empty IPA', () => {
    for (const stageId of ['greetings', 'introductions']) {
      const stage = getStage(stageId)!;
      for (const block of stage.blocks) {
        if (block.type === 'WORD') {
          const vocab = getVocabItem(block.vocabId);
          expect(vocab).not.toBeNull();
          expect(vocab!.ipa.length).toBeGreaterThan(0);
          expect(vocab!.word.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the "What is your name?" question block exists in the introductions stage', () => {
    const stage = getStage('introductions')!;
    const hasQuestion = stage.blocks.some((b) => b.type === 'QUESTION_NAME');
    expect(hasQuestion).toBe(true);
  });
});

describe('translateFor — curated, never-fabricated translations', () => {
  it('returns a real curated translation for a known phrase/language pair', () => {
    expect(translateFor('hello', 'Hello', 'ka')).toBe('გამარჯობა');
    expect(translateFor('hello', 'Hello', 'de')).toBe('Hallo');
  });

  it('falls back to the English text for an uncurated nativeLang, never fabricating', () => {
    expect(translateFor('hello', 'Hello', 'zh')).toBe('Hello');
    expect(translateFor('hello', 'Hello', 'sw')).toBe('Hello');
  });

  it('falls back to the English text for a curated language with no entry for that phrase', () => {
    expect(translateFor('some-unknown-phrase-id', 'Something', 'ka')).toBe('Something');
  });

  it('is case/whitespace-tolerant on the nativeLang code', () => {
    expect(translateFor('hello', 'Hello', ' KA ')).toBe('გამარჯობა');
  });
});

describe('applyLearnerName', () => {
  it('substitutes {name} with the trimmed learner name', () => {
    expect(applyLearnerName('I am {name}.', '  Nino  ')).toBe('I am Nino.');
  });

  it('leaves text with no {name} placeholder unchanged', () => {
    expect(applyLearnerName('Hello!', 'Nino')).toBe('Hello!');
  });

  it('replaces every occurrence of {name}, not just the first', () => {
    expect(applyLearnerName('{name} says hi, {name}!', 'Nino')).toBe('Nino says hi, Nino!');
  });
});

describe('isWriteAnswerCorrect — deterministic server-side grading', () => {
  it('accepts an exact match', () => {
    expect(isWriteAnswerCorrect('Hello', null, 'Hello')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isWriteAnswerCorrect('Hello', null, 'hello')).toBe(true);
    expect(isWriteAnswerCorrect('Hello', null, 'HELLO')).toBe(true);
  });

  it('is tolerant of surrounding whitespace and terminal punctuation', () => {
    expect(isWriteAnswerCorrect('Hello', null, '  hello  ')).toBe(true);
    expect(isWriteAnswerCorrect('I am {name}.', 'Nino', 'I am Nino')).toBe(true);
    expect(isWriteAnswerCorrect('I am {name}.', 'Nino', 'i am nino.')).toBe(true);
  });

  it('substitutes the learner name into the expected template before comparing', () => {
    expect(isWriteAnswerCorrect('My name is {name}.', 'Nino', 'My name is Nino.')).toBe(true);
    expect(isWriteAnswerCorrect('My name is {name}.', 'Nino', 'My name is Giorgi.')).toBe(false);
  });

  it('rejects a genuinely wrong answer', () => {
    expect(isWriteAnswerCorrect('Hello', null, 'Goodbye')).toBe(false);
  });

  it('never silently matches an empty submission against a real expected answer', () => {
    expect(isWriteAnswerCorrect('Hello', null, '')).toBe(false);
  });
});

describe('normalizeForComparison', () => {
  it('collapses internal whitespace and strips terminal punctuation only', () => {
    expect(normalizeForComparison('  I   am   Nino.  ')).toBe('i am nino');
    expect(normalizeForComparison('Hello!!!')).toBe('hello');
  });
});
