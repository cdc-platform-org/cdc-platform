// Runs once per Jest worker, before any test file (and therefore before
// utils/env.ts's dotenv.config() call) loads — dotenv never overwrites an
// already-set process.env value, so pre-setting DATABASE_URL here points
// every test at a disposable database instead of the real local dev DB in
// Backend/.env. Deliberately not a committed .env.test file: these are
// throwaway local-Postgres values, not secrets, and setting them in code
// avoids ever needing to reason about whether an env file is safe to commit.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:devpassword123@localhost:5432/cdc_platform_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-used-anywhere-real';
process.env.PORT = process.env.PORT || '4099';
process.env.AZURE_STORAGE_ACCOUNT_URL = process.env.AZURE_STORAGE_ACCOUNT_URL || 'https://test-unused.blob.core.windows.net';
process.env.AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'test-unused';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
