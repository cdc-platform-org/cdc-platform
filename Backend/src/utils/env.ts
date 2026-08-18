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
// Trimmed and stripped of accidental wrapping quotes: hosting dashboards
// (Azure App Service, Vercel, etc.) store whatever string you paste
// verbatim — a value copied as `"816...apps.googleusercontent.com"` (quotes
// included) becomes part of the literal client ID, so it never matches the
// `aud` claim on the ID token and every Google sign-in fails verification
// with no indication why (same failure mode as the GEMINI_API_KEY fix).
export const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^['"]|['"]$/g, '');

// GitHub/Facebook use the traditional server-side redirect + code-exchange
// OAuth flow (unlike Google above, which verifies a client-side ID token
// and never needs a secret for that) — see routes/auth.ts's /github and
// /facebook routes. Same defensive trim/quote-strip as GOOGLE_CLIENT_ID.
function cleanEnv(value: string | undefined): string {
  return (value || '').trim().replace(/^['"]|['"]$/g, '');
}
export const GITHUB_CLIENT_ID = cleanEnv(process.env.GITHUB_CLIENT_ID);
export const GITHUB_CLIENT_SECRET = cleanEnv(process.env.GITHUB_CLIENT_SECRET);
export const FACEBOOK_CLIENT_ID = cleanEnv(process.env.FACEBOOK_CLIENT_ID);
export const FACEBOOK_CLIENT_SECRET = cleanEnv(process.env.FACEBOOK_CLIENT_SECRET);
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
// Deliberately NOT requireEnv() — comma-separated allow-list of emails that
// get auto-promoted to adminRole SUPER_ADMIN the moment they register, log
// in, or sign in with Google (see routes/auth.ts's maybePromoteSuperAdmin).
// Empty by default so this is opt-in per deployment, not a code-level
// backdoor baked into every environment that runs this codebase.
export const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
// Deliberately NOT requireEnv() — the app must still boot without a Resend
// account configured; email sends fall back to console-logging the link
// instead (see services/emailService.ts). Same reasoning as GOOGLE_CLIENT_ID.
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || 'CDC Platform <no-reply@cdc.org.ge>';
// Deliberately NOT requireEnv() — the app must still boot without a Gemini
// account configured; exam question generation just responds 501 until this
// is set (see services/aiExamService.ts), same pattern as Bunny/BOG above.
// Also powers the automated lesson subtitle pipeline (services/subtitleService.ts).
// Same key as Frontend's GEMINI_API_KEY (used server-side there too, in
// pages/api/chat.ts — never exposed to the browser).
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Bunny Storage (a plain object-storage zone — distinct from Bunny Stream
// above, which is video-specific). Deliberately NOT requireEnv() — the app
// must still boot without it configured; image upload routes just respond
// 501 until these are set (see services/bunnyStorage.ts).
export const BUNNY_STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME || '';
export const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || '';
export const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
// Public pull-zone base URL for reading back what was uploaded, e.g.
// "https://cdc-storage.b-cdn.net" — no trailing slash.
export const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || '';
// This server's own public origin, e.g. "https://api.cdc.org.ge" — no
// trailing slash. Used only to build a URL for the local-disk image-upload
// fallback (services/imageStorage.ts) when Bunny Storage isn't configured;
// same pattern/fallback as routes/payments.ts's BACKEND_URL.
export const BACKEND_URL = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
// GitHub/Facebook's redirect_uri must match character-for-character what's
// registered in that provider's OAuth App dashboard (GitHub → Settings →
// Developer settings → OAuth Apps; Facebook → App Dashboard → Facebook
// Login → Settings) — a mismatch (including scheme) is exactly what
// produces GitHub's "The redirect_uri is not associated with this
// application". Same https-forcing safety net as routes/payments.ts's
// resolveHttpsCallbackUrl(): BACKEND_URL degrading to its http://localhost
// dev fallback in production (e.g. an unset Azure App Setting) would
// otherwise silently send a redirect_uri neither provider ever accepts, with
// no indication why. GITHUB_CALLBACK_URL/FACEBOOK_CALLBACK_URL are optional
// explicit overrides for when the public URL a provider must redirect back
// to differs from BACKEND_URL itself (e.g. behind a different reverse-proxy
// path) — unset by default, falling back to BACKEND_URL + the fixed path.
function resolveHttpsUrl(path: string): string {
  const httpsBase = BACKEND_URL.startsWith('https://') ? BACKEND_URL : `https://${BACKEND_URL.replace(/^https?:\/\//, '')}`;
  return `${httpsBase}${path}`;
}
export const GITHUB_CALLBACK_URL = cleanEnv(process.env.GITHUB_CALLBACK_URL) || resolveHttpsUrl('/api/auth/github/callback');
export const FACEBOOK_CALLBACK_URL = cleanEnv(process.env.FACEBOOK_CALLBACK_URL) || resolveHttpsUrl('/api/auth/facebook/callback');
// Name printed on the left-hand ("დირექტორი / Director") signature rule of
// every course certificate — see services/certificateService.ts. Deliberately
// NOT requireEnv() and deliberately not defaulted to a placeholder person:
// when it's unset the rule is left blank with only its role caption printed,
// rather than signing certificates with a fabricated name.
//
// This must be the person whose SCANNED SIGNATURE is baked into
// public/templates/certificate-template.pdf (the signature image sits directly
// above this rule and is part of the artwork, so it cannot follow the env var).
// Setting a different name here prints one person's name under another's
// signature. Re-export the template if the signatory changes.
export const CERTIFICATE_DIRECTOR_NAME = process.env.CERTIFICATE_DIRECTOR_NAME || '';
// Google Calendar — creates a real event (with Google Meet link, both
// student and mentor invited) on the Center's own calendar once a
// mentorship BogPayment completes. Deliberately NOT requireEnv() — the app
// (and mentorship checkout) must still boot without this configured;
// services/googleCalendarService.ts just records calendarSyncError on the
// MentorshipBooking and never blocks payment/enrollment on it.
//
// Requires a Google Cloud service account with domain-wide delegation
// impersonating GOOGLE_CALENDAR_ID (Workspace Admin Console → Security →
// API Controls → Domain-wide Delegation, authorized for the
// https://www.googleapis.com/auth/calendar scope) — a plain OAuth client
// (like GOOGLE_CLIENT_ID above) cannot create events as another mailbox.
export const GOOGLE_CALENDAR_CLIENT_EMAIL = (process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || '').trim();
// Service account private keys are typically pasted into hosting dashboards
// with literal "\n" sequences instead of real newlines — un-escape them,
// same failure mode as GEMINI_API_KEY/GOOGLE_CLIENT_ID above.
export const GOOGLE_CALENDAR_PRIVATE_KEY = (process.env.GOOGLE_CALENDAR_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n');
export const GOOGLE_CALENDAR_ID = (process.env.GOOGLE_CALENDAR_ID || 'contact@cdc.org.ge').trim();
// Deliberately NOT requireEnv() — the app must still boot without an Azure
// OpenAI resource configured. This is the 4th-rung fallback in
// services/azureOpenAiService.ts, reached only once every model in the
// Gemini fallback chain (examProctoringService.ts / aiAgentService.ts) has
// already failed — a Google-wide Gemini outage no longer takes down exam
// generation/grading if this is set, same "optional until configured"
// pattern as GEMINI_API_KEY itself.
export const AZURE_OPENAI_API_KEY = (process.env.AZURE_OPENAI_API_KEY || '').trim();
export const AZURE_OPENAI_ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/$/, '');
export const AZURE_OPENAI_DEPLOYMENT_NAME = (process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '').trim();
// Azure OpenAI requires an explicit API version per request — unlike Gemini,
// there's no "-latest" alias, so this is pinned to a known-GA version rather
// than guessed. Override via env if your deployment needs a different one.
export const AZURE_OPENAI_API_VERSION = (process.env.AZURE_OPENAI_API_VERSION || '2024-10-21').trim();
