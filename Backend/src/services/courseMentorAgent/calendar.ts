/**
 * Course Mentor Agent — class calendar.
 * Exports: isoDate, parseIsoDate, listClassDays, allocateLessonsToModules.
 *
 * Pure date math, no AI: which calendar days the class actually meets, and
 * how many of those days each module gets. Kept deterministic on purpose so
 * the course always ends exactly on the teacher's end date, whatever the
 * model proposes.
 */

const DAY_MS = 86_400_000;

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Dates are handled as UTC midnight so a server in any timezone produces
// the same calendar (Postgres DATE columns carry no timezone either).
export function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

// ISO weekday: 1 = Monday ... 7 = Sunday.
function isoWeekday(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export function listClassDays(start: Date, end: Date, weekdays: number[], excludedDates: string[] = []): Date[] {
  if (end.getTime() < start.getTime()) return [];
  const allowed = new Set(weekdays);
  const excluded = new Set(excludedDates);
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    if (allowed.has(isoWeekday(d)) && !excluded.has(isoDate(d))) days.push(d);
  }
  return days;
}

// Splits `totalLessons` class days across modules in proportion to their
// weight (largest-remainder method), guaranteeing every module at least
// one lesson and the counts summing exactly to totalLessons.
export function allocateLessonsToModules(weights: number[], totalLessons: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (totalLessons < n) {
    throw new Error(`Only ${totalLessons} class days for ${n} modules — extend the course or merge modules.`);
  }
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1));
  const sum = safe.reduce((a, b) => a + b, 0);
  const spare = totalLessons - n; // each module already holds 1
  const exact = safe.map((w) => (w / sum) * spare);
  const counts = exact.map((x) => 1 + Math.floor(x));
  let left = totalLessons - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) counts[order[k].i]++;
  return counts;
}
