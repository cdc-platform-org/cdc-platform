// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/uploads/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase's existing convention for an intentionally-unused
      // parameter (e.g. paymentGatewayService.chargeCard's
      // _paymentMethodId/_amountTetri placeholders) is a leading
      // underscore, not omission — recognize it instead of flagging it.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `declare global { namespace Express { ... } }` is the standard,
      // Express-team-documented way to augment Request/Response with custom
      // fields (see middleware/auth.ts, routes/gigs.ts, server.ts, etc.) —
      // not a code smell to fix, this rule just doesn't have a carve-out
      // for ambient global augmentation.
      '@typescript-eslint/no-namespace': 'off',
      // 79 pre-existing uses across the codebase (error handlers, JSON
      // payloads, a handful of intentionally-loose admin/report shapes) —
      // downgraded to a visible warning rather than mass-edited in this
      // lint-introduction pass, which risks introducing real type bugs by
      // guessing at types under time pressure. Kept as `warn`, not `off`,
      // so new `any` usage is still visible in `pnpm lint` output.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // jest.resetModules() + require() is the documented pattern this suite
    // uses to re-import a module under a different process.env value (see
    // services/__tests__/paymentGatewayService.test.ts) — a static import
    // can't be re-evaluated mid-file the way a dynamic require() can.
    files: ['src/**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
