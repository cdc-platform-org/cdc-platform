/**
 * Account settings: PUT /me (profile fields) and PUT /me/password.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { updateProfileSchema, changePasswordSchema } from '../../schemas/authSchemas';
import { authenticate } from '../../middleware/auth';
import { sendPayoutIbanChangedEmail } from '../../services/integrations/emailService';
import { detectSessionAnomaly } from '../../services/account/sessionAnomalyService';
import { verifyStepUp, StepUpRequiredError } from '../../utils/stepUpAuth';
import { toUserResponse } from './shared';

const router = Router();

router.put('/me', authenticate, async (req, res) => {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { payoutIban, websiteUrl, currentPassword, ...rest } = result.data;
  const normalizedIban = payoutIban || null;

  // Read the current value first so we can tell whether this request is
  // actually changing it — payoutIban is the one field on this route real
  // money follows, and bogPayoutService's risk engine treats a recent
  // change to it as a mandatory manual-review trigger regardless of
  // amount (see User.payoutIbanUpdatedAt's own schema comment). Only
  // stamped — and only emailed — on a genuine change, not every PUT that
  // happens to re-submit the same value.
  const before = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { payoutIban: true, email: true, password: true, googleId: true },
  });
  if (!before) return res.status(404).json({ message: 'Account no longer exists.' });
  const ibanChanged = payoutIban !== undefined && normalizedIban !== (before.payoutIban ?? null);

  // Step-up gate: changing payoutIban from a session
  // sessionAnomalyService flags as anomalous (unrecognized IP/device)
  // additionally requires proving the request really is the account
  // owner, not just a valid JWT — see utils/stepUpAuth.ts's own header
  // comment for why. Every other profile field on this route is
  // unaffected; this only ever runs when payoutIban is actually changing.
  if (ibanChanged) {
    const anomaly = await detectSessionAnomaly({
      userId: req.user!.id,
      currentIp: req.ip ?? 'unknown',
      currentUserAgent: req.headers['user-agent'],
    });
    if (anomaly.anomalous) {
      try {
        await verifyStepUp(before, currentPassword);
      } catch (err) {
        if (err instanceof StepUpRequiredError) {
          return res.status(403).json({ code: 'STEP_UP_REQUIRED', message: err.message });
        }
        throw err;
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...rest,
      payoutIban: normalizedIban,
      websiteUrl: websiteUrl || null,
      ...(ibanChanged ? { payoutIbanUpdatedAt: new Date() } : {}),
    },
  });
  if (ibanChanged && before.email) {
    sendPayoutIbanChangedEmail(before.email).catch((err) => console.error(`[auth] sendPayoutIbanChangedEmail failed for ${before.email}:`, err));
  }
  res.json({ user: toUserResponse(user) });
});

router.put('/me/password', authenticate, async (req, res) => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ message: 'Account no longer exists.' });
  if (user.googleId) {
    return res.status(400).json({ message: 'This account signs in via Google and has no password to change.' });
  }
  const currentMatches = await bcrypt.compare(result.data.currentPassword, user.password);
  if (!currentMatches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  const hashed = await bcrypt.hash(result.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  res.json({ message: 'Password updated successfully.' });
});

export default router;
