module.exports = {
  i18n: {
    defaultLocale: 'ka',
    // Georgian stays default (this is a Georgian platform first); en/de/es/fr/uk
    // are the secondary/international set, all translated from the same
    // en/ka source namespaces — see public/locales/<lang>/*.json.
    locales: ['ka', 'en', 'de', 'es', 'fr', 'uk'],
  },
  defaultNS: 'auth', // tell next-i18next to use auth.json as the default namespace
};
