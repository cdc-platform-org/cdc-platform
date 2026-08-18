// Next.js's own instrumentation hook (requires experimental.instrumentationHook
// in next.config.mjs on Next 14 — stable-by-default from Next 15 on). Sentry's
// installed package itself now recommends this file over the older
// sentry.server.config.ts/sentry.edge.config.ts convention (see the deprecation
// warning in @sentry/nextjs's webpack config) — Sentry.init() must run here
// before any other server code, for both the nodejs and edge runtimes this
// app could run under.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return; // optional integration, same pattern as GEMINI_API_KEY etc. — no-op until configured

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
}

// Captures errors from Server Components / SSR data fetching that Next.js's
// own error boundary would otherwise only log to the server console.
export const onRequestError = Sentry.captureRequestError;
