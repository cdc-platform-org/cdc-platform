import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';
import pkg from './next-i18next.config.js';
const { i18n } = pkg;

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,
  // Required on Next 14 for instrumentation.ts's register()/onRequestError
  // hooks to actually run (stable-by-default from Next 15 on) — see
  // instrumentation.ts for the Sentry server/edge init this enables.
  experimental: {
    instrumentationHook: true,
  },
  // Next 14.2.5's webpack config only auto-derives the "@/*" alias from
  // tsconfig.json when moduleResolution is "node"/"node10"/etc — it doesn't
  // recognize "bundler" (a newer TS mode), so the alias silently stops
  // resolving at build/runtime even though `tsc --noEmit` still passes
  // (type-checking and webpack bundling resolve modules differently). This
  // sets the alias explicitly so it works regardless of that tsconfig setting.
  webpack: (config) => {
    config.resolve.alias['@'] = projectRoot;
    return config;
  },
};

// Wraps the config to auto-inject instrumentation-client.ts into the client
// bundle and (optionally) upload source maps to Sentry on build. Source map
// upload only activates once SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are
// set (an org account this project doesn't have yet) — until then it's a
// no-op and the build behaves exactly as before. `silent: true` keeps that
// no-op quiet in CI instead of a confusing "no auth token" warning on every
// build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true } },
});
