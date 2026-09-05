import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

// Runs before hydration/first paint on every page, so the `dark` class is
// correct immediately — no flash of the wrong theme, and no race with
// React mounting (the previous approach only set this from a useEffect on
// the homepage, so every other route ignored the saved preference and a
// user's dark-mode choice could appear "stuck" once they navigated away).
const themeInitScript = `
(function () {
  try {
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps, locale: ctx.locale ?? 'ka' };
  }

  render() {
    // Was hardcoded to "en" regardless of the actual active locale — wrong
    // for accessibility (screen readers) and SEO on every Georgian page,
    // which is most of the site's default traffic.
    const locale = (this.props as { locale?: string }).locale ?? 'ka';
    return (
      <Html lang={locale}>
        <Head>
          {/* Removed a duplicated block of homepage-hardcoded OG/Twitter/canonical/hreflang/JSON-LD
              tags that used to render here on every route, overriding each page's own SEOHead tags.
              SEOHead (src/components/seo/SEOHead.tsx) is the single source of truth for these now. */}
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          <link rel="icon" href="/favicon.ico" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
