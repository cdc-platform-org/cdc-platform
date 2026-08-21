// HR Assistance pricing — 200 GEL base (screening + task evaluation + one
// video interview per shortlisted candidate + Top-3 report) for up to 10
// applicants on the vacancy, +50 GEL per applicant beyond that. Amounts are
// minor units (tetri), matching every other price on this platform.
export const HR_BASE_FEE = 20000; // 200 GEL
export const HR_INCLUDED_CANDIDATES = 10;
export const HR_EXTRA_CANDIDATE_FEE = 5000; // 50 GEL

export function calculateHRSupportFee(candidateCount: number): number {
  const extraCandidates = Math.max(0, candidateCount - HR_INCLUDED_CANDIDATES);
  return HR_BASE_FEE + extraCandidates * HR_EXTRA_CANDIDATE_FEE;
}
