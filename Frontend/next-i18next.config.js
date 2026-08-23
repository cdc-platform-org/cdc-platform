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
};
