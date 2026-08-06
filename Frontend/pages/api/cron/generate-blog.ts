import type { NextApiRequest, NextApiResponse } from 'next';

// Vercel Cron entry point — scheduled twice a week (Mon & Thu) via
// vercel.json's `crons` config. Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` on its own scheduled requests when
// CRON_SECRET is set as a Vercel project env var (see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) —
// checked here so this route can't be triggered by an arbitrary public
// request. All the real work (Prisma access, Gemini calls) happens on the
// Backend; this route just relays the trigger, forwarding the same shared
// secret as the X-Cron-Secret header Backend's routes/cron.ts expects.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(501).json({ message: 'CRON_SECRET is not configured.' });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  try {
    const backendRes = await fetch(`${apiBaseUrl}/cron/generate-blog-draft`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': cronSecret, 'Content-Type': 'application/json' },
    });
    const data = await backendRes.json().catch(() => ({}));
    return res.status(backendRes.status).json(data);
  } catch (err) {
    console.error('[api/cron/generate-blog] Failed to reach the backend:', err);
    return res.status(502).json({ message: 'Failed to reach the backend.' });
  }
}
