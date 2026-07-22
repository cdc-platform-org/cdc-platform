import Document, { Html, Head, Main, NextScript } from 'next/document';

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
  render() {
    return (
      <Html lang="en">
        <Head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
