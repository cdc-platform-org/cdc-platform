// Design Studio mentor: the system prompt must pin the reply language to the
// student's site language and describe the active workspace mode.
import { buildDesignMentorInstruction, DESIGN_MENTOR_LOCALES } from '../learning/designMentorService';

describe('buildDesignMentorInstruction', () => {
  test('pins Georgian when the site is in Georgian', () => {
    const text = buildDesignMentorInstruction({ locale: 'ka', mode: 'photo', activeTool: 'brush' });
    expect(text).toContain('Always reply in Georgian');
    expect(text).toContain('Photo (raster) mode');
    expect(text).toContain('Tool currently selected: brush');
  });

  test('describes the vector workspace and every site language has a name', () => {
    const text = buildDesignMentorInstruction({ locale: 'hy', mode: 'vector' });
    expect(text).toContain('Always reply in Armenian');
    expect(text).toContain('Vector mode');
    for (const locale of DESIGN_MENTOR_LOCALES) {
      expect(buildDesignMentorInstruction({ locale, mode: 'vector' })).not.toContain('reply in undefined');
    }
  });
});
