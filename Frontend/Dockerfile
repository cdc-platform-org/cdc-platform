# syntax=docker/dockerfile:1
#
# Azure Web App (Linux container) image for the Next.js frontend — mirrors
# Backend/Dockerfile's two-stage build/runtime shape and base image so both
# apps deploy through the same ACR + `az webapp config container set`
# pipeline (see .github/workflows/main_cdc-frontend-prod.yml). Vercel never
# reads this file — deploying there still works unmodified if it's ever
# used again, since `output: 'standalone'` (next.config.mjs) only changes
# what `next build` additionally produces, not how the app itself behaves.

# ---- Stage 1: install deps, build the standalone Next.js server ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build-time NEXT_PUBLIC_* values get baked into the client bundle by
# `next build` itself — there is no way to swap them in later at container
# start the way server-only env vars can be, so they must be real build
# ARGs, not just runtime `ENV`. Passed in by the deploy workflow from
# GitHub secrets; safe to be build args since NEXT_PUBLIC_* values are
# public by definition (shipped to every browser regardless).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY . .
RUN pnpm run build

# ---- Stage 2: runtime image — only the standalone server + static assets,
# not the full builder node_modules/source tree. ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Azure App Service (Linux, custom container) expects the app to listen on
# WEBSITES_PORT if set, defaulting to 80 — 8080 here matches that default
# and is set explicitly in the App Service Configuration too (see this
# repo's ops notes / the deploy workflow's own comment) so both agree.
ENV PORT=8080
EXPOSE 8080

# Server-only secrets (GEMINI_API_KEY, CRON_SECRET, SENTRY_AUTH_TOKEN, etc.)
# are deliberately NOT baked in here — unlike NEXT_PUBLIC_*, these are read
# at request time by API routes, so they belong in the Web App's
# Application Settings (real runtime env vars), never in the image itself.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
