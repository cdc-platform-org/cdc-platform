import { minimizeForAi } from '../educatorPrivacyService';

// D8 — direct unit coverage for the deterministic minimization layer.
// Fixtures below are entirely synthetic/fake — no real student data.

describe('minimizeForAi', () => {
  it('removes an email address', () => {
    const out = minimizeForAi('Contact the parent at nino.test.parent@example.com for details.');
    expect(out).not.toContain('nino.test.parent@example.com');
    expect(out).toContain('[EMAIL_REMOVED]');
  });

  it('removes a formatted phone number', () => {
    const out = minimizeForAi('Call the parent at +995 555 123 456 after school.');
    expect(out).not.toContain('555 123 456');
    expect(out).toContain('[PHONE_REMOVED]');
  });

  it('removes a bare 11-digit personal-ID-shaped number', () => {
    const out = minimizeForAi('The student\'s personal number is 01234567890, filed with the office.');
    expect(out).not.toContain('01234567890');
    expect(out).toContain('[ID_REMOVED]');
  });

  it('removes a bare 9-digit ID-shaped number', () => {
    const out = minimizeForAi('Document number 123456789 was attached.');
    expect(out).not.toContain('123456789');
    expect(out).toContain('[ID_REMOVED]');
  });

  it('removes multiple distinct identifiers in the same text', () => {
    const out = minimizeForAi('Email parent.test@example.com or call +995 555 123 456. ID: 01234567890.');
    expect(out).toContain('[EMAIL_REMOVED]');
    expect(out).toContain('[PHONE_REMOVED]');
    expect(out).toContain('[ID_REMOVED]');
    expect(out).not.toContain('parent.test@example.com');
    expect(out).not.toContain('01234567890');
  });

  it('preserves ordinary educational English text untouched', () => {
    const text = 'The student struggled with fractions this week but showed strong improvement in word problems.';
    expect(minimizeForAi(text)).toBe(text);
  });

  it('preserves ordinary educational Georgian text untouched', () => {
    const text = 'მოსწავლემ ამ კვირას კარგად გააუმჯობესა წაკითხულის გააზრების უნარი.';
    expect(minimizeForAi(text)).toBe(text);
  });

  it('preserves Georgian text while still stripping an embedded email/phone', () => {
    const out = minimizeForAi('მშობელს დაუკავშირდით: test.parent@example.com ან +995 555 123 456.');
    expect(out).toContain('მშობელს დაუკავშირდით');
    expect(out).toContain('[EMAIL_REMOVED]');
    expect(out).toContain('[PHONE_REMOVED]');
  });

  it('does not alter small, clearly non-identifying numbers (grade/scale-like)', () => {
    const text = 'Grade 7, scored 85 out of 100 on question 3.';
    expect(minimizeForAi(text)).toBe(text);
  });

  it('handles empty/undefined-ish input without throwing', () => {
    expect(minimizeForAi('')).toBe('');
  });
});
