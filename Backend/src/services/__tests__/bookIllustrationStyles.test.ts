import { ILLUSTRATION_STYLE_KEYS, illustrationStylePromptLine, isIllustrationStyle } from '../bookIllustrationStyles';

describe('illustration styles', () => {
  it('offers the six wizard styles', () => {
    expect(ILLUSTRATION_STYLE_KEYS).toEqual(['STORYBOOK_WATERCOLOR', 'MODERN_3D', 'SOFT_DIGITAL', 'CARTOON', 'FANTASY', 'CLASSIC']);
    expect(isIllustrationStyle('CARTOON')).toBe(true);
    expect(isIllustrationStyle('BOGUS')).toBe(false);
    expect(isIllustrationStyle(undefined)).toBe(false);
  });

  it('describes the chosen style to the model and falls back to watercolor', () => {
    expect(illustrationStylePromptLine('MODERN_3D')).toContain('3D');
    expect(illustrationStylePromptLine('CARTOON')).toContain('cartoon');
    expect(illustrationStylePromptLine(null)).toContain('watercolor');
    expect(illustrationStylePromptLine('BOGUS')).toContain('watercolor');
  });
});
