import { isAcceptableQaStatus } from '../bookQaService';

describe('isAcceptableQaStatus', () => {
  it('accepts PASS (mock) and PARTIAL (real image, vision-QA not wired yet)', () => {
    expect(isAcceptableQaStatus('PASS')).toBe(true);
    expect(isAcceptableQaStatus('PARTIAL')).toBe(true);
  });

  it('rejects FAIL (generation failed / no valid image)', () => {
    expect(isAcceptableQaStatus('FAIL')).toBe(false);
  });
});
