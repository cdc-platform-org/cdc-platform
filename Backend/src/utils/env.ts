import dotenv from 'dotenv';
dotenv.config();

/**
 * დამხმარე ფუნქცია, რომელიც ამოწმებს გარემო ცვლადის არსებობას.
 * თუ ცვლადი არ არის გაწერილი .env ფაილში, აპლიკაცია არ ჩაირთვება და დააბრუნებს შეცდომას.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Check your .env file.`);
  }
  return value;
}

// აპლიკაციის ძირითადი კონფიგურაცია
export const DATABASE_URL = requireEnv('DATABASE_URL');
export const JWT_SECRET = requireEnv('JWT_SECRET');
export const PORT = Number(requireEnv('PORT'));
// e.g. "https://<account>.blob.core.windows.net" — no key or connection string;
// auth is via Managed Identity / Azure AD (see routes/upload.ts).
export const AZURE_STORAGE_ACCOUNT_URL = requireEnv('AZURE_STORAGE_ACCOUNT_URL');
export const AZURE_STORAGE_CONTAINER_NAME = requireEnv('AZURE_STORAGE_CONTAINER_NAME');
// Shared secret an external scheduler (Azure Logic App, GitHub Actions cron,
// cron-job.org, etc.) sends as the X-Cron-Secret header when hitting
// POST /api/cron/auto-approve — see routes/cron.ts.
export const CRON_SECRET = requireEnv('CRON_SECRET');
// Deliberately NOT requireEnv() — unlike the vars above, the app boots fine
// without this; POST /api/auth/google just responds 501 until it's set.
// Must match the client ID the frontend's NEXT_PUBLIC_GOOGLE_CLIENT_ID uses
// (see Frontend/src/components/auth/AuthModal.tsx), both from the same
// Google Cloud OAuth 2.0 Client ID (Google Cloud Console → APIs & Services →
// Credentials → OAuth client ID → Web application).
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// Deliberately NOT requireEnv() — Bank of Georgia payment routes fall back to
// the Admin Panel's BogSettings DB record (see services/bogPaymentService.ts)
// when these are unset, so the app must still boot without them.
export const BOG_CLIENT_ID = process.env.BOG_CLIENT_ID || '';
export const BOG_SECRET_KEY = process.env.BOG_SECRET_KEY || '';
// Deliberately NOT requireEnv() — the app (and course browsing/purchasing)
// must still boot without a Bunny Stream account configured yet; video
// upload/playback routes just respond 501 until these are set (see
// services/bunnyStreamService.ts).
export const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY || '';
export const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '';
// Pull-zone hostname for direct asset delivery (thumbnails), e.g. "vz-xxxxx.b-cdn.net".
// Distinct from the fixed player.mediadelivery.net embed domain, which is not configurable.
export const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || '';