#!/bin/sh
# Applies any pending Prisma migrations against DATABASE_URL (already set as
# an Azure App Service setting) before the server starts. Previously nothing
# in this pipeline ever ran migrations on deploy — schema changes had to be
# applied to production by hand, out of band from the actual code deploy,
# which is easy to forget and leaves the deployed code mismatched against
# the live schema. `set -e` means a failed migration stops the container
# from starting rather than serving requests against a stale schema.
set -e
npx prisma migrate deploy
exec node dist/server.js
