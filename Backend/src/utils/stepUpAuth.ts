import bcrypt from 'bcryptjs';

// ============================================================
// Step-up re-authentication — a lightweight PSD2/SCA-adjacent control for
// the two financial actions sessionAnomalyService.detectSessionAnomaly can
// flag: changing the payout IBAN (routes/auth.ts PUT /me) and requesting a
// payout (routes/wallet.ts POST /payout-requests). Deliberately simple:
// no separate re-authenticate endpoint or short-lived token, just require
// the SAME request that's already anomalous to also carry the account's
// current password, verified inline. A stolen JWT alone is no longer
// enough to complete either action from an unrecognized IP/device — the
// attacker would also need the password.
//
// Only ever called AFTER a caller has already confirmed
// detectSessionAnomaly() fired — this file has no opinion on when step-up
// is needed, only on what "step-up satisfied" means once it is.
// ============================================================

export const STEP_UP_REQUIRED_MESSAGE = 'Recent password re-verification required for financial security';

export class StepUpRequiredError extends Error {
  constructor(message: string = STEP_UP_REQUIRED_MESSAGE) {
    super(message);
    this.name = 'StepUpRequiredError';
  }
}

// Throws StepUpRequiredError for every way step-up can fail — missing
// password, wrong password, or an OAuth-only account with no real
// password to check (same googleId gate as routes/auth.ts's existing
// changePasswordSchema route) — so every call site maps this to the same
// 403 { code: 'STEP_UP_REQUIRED', message } shape without needing to
// distinguish the reason itself.
export async function verifyStepUp(
  user: { password: string; googleId: string | null },
  currentPassword: string | undefined
): Promise<void> {
  if (user.googleId) {
    throw new StepUpRequiredError(
      'This account signs in via Google and has no password to re-verify — sign out and back in to refresh your session, then try again.'
    );
  }
  if (!currentPassword) {
    throw new StepUpRequiredError();
  }
  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    throw new StepUpRequiredError();
  }
}
