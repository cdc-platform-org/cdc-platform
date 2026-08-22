/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/test/setupEnv.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }],
  },
  // Integration tests share one real Postgres database (see test/setupEnv.ts) —
  // parallel workers would race on singleton rows (PlatformFeeSchedule,
  // PlatformSettings, BillingSettings) and on unique constraints across
  // suites. Serial execution trades speed for determinism, same tradeoff
  // qa-nightly.yml's Playwright suite makes for the same underlying reason.
  maxWorkers: 1,
  testTimeout: 20000,
};
