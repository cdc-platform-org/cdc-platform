import { generateTeacherCertificatePdf } from '../certificateService';

// Pure PDF composition (pdf-lib, no network/DB) — safe to run for real
// rather than mocking. Confirms Fix D1's certificate generator actually
// produces a valid, non-trivial PDF for every certificate type and both
// supported languages, not just that the function doesn't throw.
describe('generateTeacherCertificatePdf', () => {
  const types = ['WEEKLY_STAR', 'COURSE_COMPLETION', 'OLYMPIAD_WINNER'] as const;

  it.each(types)('produces a valid PDF for %s in Georgian', async (certificateType) => {
    const buffer = await generateTeacherCertificatePdf({
      studentName: 'ნინო ბერიძე',
      certificateType,
      language: 'ka',
      issueDate: new Date('2026-01-15'),
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it.each(types)('produces a valid PDF for %s in English', async (certificateType) => {
    const buffer = await generateTeacherCertificatePdf({
      studentName: 'Nino Beridze',
      certificateType,
      language: 'en',
      issueDate: new Date('2026-01-15'),
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a CUSTOM certificate using the supplied nomination text', async () => {
    const buffer = await generateTeacherCertificatePdf({
      studentName: 'Giorgi Maisuradze',
      certificateType: 'CUSTOM',
      customNomination: 'Best class project of the semester',
      language: 'en',
      issueDate: new Date('2026-01-15'),
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('handles a mixed Georgian/Latin student name without throwing', async () => {
    const buffer = await generateTeacherCertificatePdf({
      studentName: 'ია Tavdishvili',
      certificateType: 'WEEKLY_STAR',
      language: 'ka',
      issueDate: new Date('2026-01-15'),
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
