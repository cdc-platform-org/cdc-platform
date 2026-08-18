// Browser-side Sentry init — auto-discovered and injected into the client
// webpack entry by @sentry/nextjs's own config wrapper (see next.config.mjs),
// the current recommended replacement for the deprecated sentry.client.config.ts
// convention. NEXT_PUBLIC_-prefixed so it's readable in the browser bundle;
// a Sentry DSN is not a secret (write-only, scoped to accepting events), same
// reasoning as any other NEXT_PUBLIC_ id in this app.
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

// Required by @sentry/nextjs for it to track Pages Router client-side
// navigations (page-to-page transitions) as part of error/performance
// context, instead of only the initial page load.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
