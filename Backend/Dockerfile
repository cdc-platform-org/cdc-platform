# syntax=docker/dockerfile:1

# ---- Stage 1: install deps, generate Prisma client, compile TypeScript ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Prisma's native query/schema engines need OpenSSL to detect the correct libssl
# version — bookworm-slim strips it out. Missing this makes Prisma silently guess
# the wrong engine variant (falls back to "openssl-1.1.x"), which fails at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm exec prisma generate
RUN pnpm run build

# ---- Stage 2: runtime image ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# node_modules is copied wholesale (not reinstalled) so pnpm's symlinked
# .pnpm virtual store — where the generated Prisma client actually lives —
# stays intact and correctly resolvable.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
