module.exports = {
  i18n: {
    defaultLocale: 'ka',
    // Georgian stays default (this is a Georgian platform first);
    // en/de/es/fr/uk/tr/hy/az are the secondary/international set, all
    // translated from the same en/ka source namespaces — see
    // public/locales/<lang>/*.json. Each covers this rollout's namespace
    // JSON files in full; the older per-component inline dictionaries a
    // few globally-shared components still keep (see utils/locale.ts's own
    // comment) are NOT yet widened past de/es/fr/uk — same staged-rollout
    // shape every locale addition since then has gone through, not an
    // oversight.
    locales: ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'],
  },
  defaultNS: 'auth', // tell next-i18next to use auth.json as the default namespace
  // Explicit namespace list — keep in sync with public/locales/<any
  // locale>/*.json (all 9 locales carry the exact same namespace set).
  //
  // Without this, next-i18next's createConfig() (see
  // node_modules/next-i18next/dist/.../config/createConfig.js) falls back to
  // auto-discovering namespaces per request via fs.readdirSync() on
  // public/locales/<locale>/ at SSR time. That auto-discovery was never
  // itself broken — it correctly finds whatever is actually on disk — but
  // it makes "which namespaces load" an implicit function of directory
  // contents at request time rather than a version-controlled fact. The
  // real bug this rollout found (raw i18n keys on Educator Hub after a
  // production hard refresh) was that public/locales/**/*.json wasn't
  // reliably on disk in the `output: standalone` build in the first place
  // — see next.config.mjs's experimental.outputFileTracingIncludes, which
  // is the actual fix for that. This explicit `ns` list is this file's own
  // complementary hardening: it makes next-i18next load a known, reviewed
  // set of namespaces by name instead of trusting whatever a directory
  // listing happens to contain at runtime.
  ns: [
    'auth',
    'billing',
    'childrensBook',
    'common',
    'courses',
    'educatorHub',
    'forum',
    'home',
    'marketplace',
    'mediaStudio',
    'mentorship',
    'proctoredExam',
    'proposals',
    'settings',
  ],
};
