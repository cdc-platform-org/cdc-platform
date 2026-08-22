module.exports = {
  i18n: {
    defaultLocale: 'ka',
    // Georgian stays default (this is a Georgian platform first);
    // en/de/es/fr/uk/tr/hy are the secondary/international set, all
    // translated from the same en/ka source namespaces — see
    // public/locales/<lang>/*.json. tr/hy cover this rollout's namespace
    // JSON files in full; the older per-component inline dictionaries a
    // few globally-shared components still keep (see utils/locale.ts's own
    // comment) are NOT yet widened to tr/hy — same staged-rollout shape the
    // original de/es/fr/uk expansion went through, not an oversight.
    locales: ['ka', 'en', 'de', 'es', 'fr', 'uk', 'tr', 'hy'],
  },
  defaultNS: 'auth', // tell next-i18next to use auth.json as the default namespace
};
