// Pure helpers of the marketing planner: Tbilisi week math and the final
// caption that gets pasted into Meta (link only on Facebook).
import { nextWeekStart, slotTime, weekStartTbilisi } from '../settings';
import { composeCaption } from '../agent';

describe('marketing planner helpers', () => {
  it('week starts Monday 00:00 Tbilisi (Sunday 20:00 UTC)', () => {
    // Wednesday 2026-11-18 10:00 UTC
    expect(weekStartTbilisi(new Date('2026-11-18T10:00:00Z')).toISOString()).toBe('2026-11-15T20:00:00.000Z');
    // Sunday 21:00 UTC is already Monday 01:00 in Tbilisi
    expect(weekStartTbilisi(new Date('2026-11-22T21:00:00Z')).toISOString()).toBe('2026-11-22T20:00:00.000Z');
    expect(nextWeekStart(new Date('2026-11-18T10:00:00Z')).toISOString()).toBe('2026-11-22T20:00:00.000Z');
  });

  it('slotTime maps day index + Tbilisi hour to UTC', () => {
    const week = new Date('2026-11-22T20:00:00Z'); // Mon 23 Nov 00:00 Tbilisi
    expect(slotTime(week, 2, 19).toISOString()).toBe('2026-11-25T15:00:00.000Z'); // Wed 19:00 Tbilisi
  });

  it('Facebook gets the clickable link, Instagram points to the bio', () => {
    const fb = composeCaption('FACEBOOK', 'ტექსტი', ['cdc', 'დიზაინი'], 'https://cdc.org.ge/store/abc');
    expect(fb).toBe('ტექსტი\n\n👉 https://cdc.org.ge/store/abc\n\n#cdc #დიზაინი');
    const ig = composeCaption('INSTAGRAM', 'ტექსტი', [], 'https://cdc.org.ge/store/abc');
    expect(ig).not.toContain('https://');
    expect(ig).toContain('ბიოშია');
  });
});
