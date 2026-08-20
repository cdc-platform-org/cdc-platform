import type { NextApiRequest, NextApiResponse } from 'next';

// Vercel Cron entry point — scheduled once daily (06:00 UTC) via vercel.json's
// `crons` config. Same relay shape as api/cron/generate-blog.ts: Vercel sends
// `Authorization: Bearer $CRON_SECRET` automatically on its own scheduled
// requests, checked here so this route can't be triggered by an arbitrary
// public request. All the real work (Prisma access, page fetches, Gemini
// calls) happens on the Backend; this route just relays the trigger.
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
    const backendRes = await fetch(`${apiBaseUrl}/cron/scan-grant-opportunities`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': cronSecret, 'Content-Type': 'application/json' },
    });
    const data = await backendRes.json().catch(() => ({}));
    return res.status(backendRes.status).json(data);
  } catch (err) {
    console.error('[api/cron/scan-grants] Failed to reach the backend:', err);
    return res.status(502).json({ message: 'Failed to reach the backend.' });
  }
}
