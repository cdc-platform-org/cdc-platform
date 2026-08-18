// Must be imported before any other module in server.ts (Sentry's own
// README: "Sentry should be initialized as early in your app as possible...
// otherwise auto-instrumentation of these modules will not work") — that's
// why this is its own file imported as literally server.ts's first line,
// ahead of even 'express-async-errors', rather than folded into server.ts.
import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';

// Deliberately NOT requireEnv() — same "optional until configured" pattern
// as every other integration in utils/env.ts (Bunny, Gemini, ...). The app
// must still boot without a Sentry account configured.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}
