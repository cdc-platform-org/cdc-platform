import bcrypt from 'bcryptjs';
import { verifyStepUp, StepUpRequiredError, STEP_UP_REQUIRED_MESSAGE } from '../stepUpAuth';

const REAL_PASSWORD = 'CorrectHorseBatteryStaple123!';
const PASSWORD_HASH = bcrypt.hashSync(REAL_PASSWORD, 10);

describe('verifyStepUp', () => {
  it('resolves without throwing when the current password matches', async () => {
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: null }, REAL_PASSWORD)).resolves.toBeUndefined();
  });

  it('throws StepUpRequiredError when currentPassword is missing', async () => {
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: null }, undefined)).rejects.toThrow(StepUpRequiredError);
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: null }, undefined)).rejects.toThrow(STEP_UP_REQUIRED_MESSAGE);
  });

  it('throws StepUpRequiredError when currentPassword is wrong', async () => {
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: null }, 'totally-wrong-password')).rejects.toThrow(
      StepUpRequiredError
    );
  });

  it('throws StepUpRequiredError when currentPassword is an empty string', async () => {
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: null }, '')).rejects.toThrow(StepUpRequiredError);
  });

  it('throws a distinct, Google-specific message for an OAuth-only account, even with a correct-looking password', async () => {
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: 'google-sub-123' }, REAL_PASSWORD)).rejects.toThrow(
      /signs in via Google/
    );
  });

  it('checks googleId before even looking at the password argument', async () => {
    // No currentPassword at all, but the google-specific error should
    // still be the one that surfaces, not the generic "missing password" one.
    await expect(verifyStepUp({ password: PASSWORD_HASH, googleId: 'google-sub-123' }, undefined)).rejects.toThrow(
      /signs in via Google/
    );
  });
});
