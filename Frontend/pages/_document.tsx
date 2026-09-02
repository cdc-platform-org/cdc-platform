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
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          <link rel="icon" href="/favicon.ico" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <meta property="og:image" content="/logo.png" />
          <meta property="og:image:alt" content="CDC Logo" />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content="/logo.png" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "EducationalOrganization",
                "name": "CDC - ციფრული პროფესიების ცენტრი",
                "url": "https://www.cdc.ge",
                "logo": "https://www.cdc.ge/logo.png",
                "sameAs": [
                  "https://www.facebook.com/cdc",
                  "https://www.instagram.com/cdc",
                  "https://www.linkedin.com/company/cdc"
                ],
                "description": "ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი."
              }),
            }}
          />
          <link rel="canonical" href="https://www.cdc.ge" />
          <link rel="alternate" href="https://www.cdc.ge" hreflang="ka-GE" />
          <link rel="alternate" href="https://www.cdc.ge/en" hreflang="en" />
          <meta name="keywords" content="ციფრული პროფესიები, ტოპ 10 პროფესია საქართველოში, მაღალანაზღაურებადი პროფესიები, ციფრული პროფესიების ცენტრი, CDC, მასწავლებლის ასისტენტი, AI ტესტების გენერატორი, ონლაინ სწავლება" />
          <meta property="og:title" content="ციფრული პროფესიების ცენტრი (CDC) - საუკეთესო პროფესიები საქართველოში" />
          <meta property="og:description" content="ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი." />
          <meta property="og:image" content="/logo.png" />
          <meta property="og:url" content="https://www.cdc.ge" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="ციფრული პროფესიების ცენტრი (CDC) - საუკეთესო პროფესიები საქართველოში" />
          <meta name="twitter:description" content="ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი." />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "EducationalOrganization",
                "name": "CDC - ციფრული პროფესიების ცენტრი",
                "url": "https://www.cdc.ge",
                "logo": "https://www.cdc.ge/logo.png",
                "sameAs": [
                  "https://www.facebook.com/cdc",
                  "https://www.instagram.com/cdc",
                  "https://www.linkedin.com/company/cdc"
                ],
                "description": "ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი."
              }),
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
