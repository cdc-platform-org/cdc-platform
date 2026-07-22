import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { AuthProvider } from '@/src/context/AuthContext';
import { AuthModalProvider } from '@/src/context/AuthModalContext';
import AuthModal from '@/src/components/auth/AuthModal';
import ScrollToTop from '@/src/components/layout/ScrollToTop';
import FloatingButtons from '@/src/components/layout/FloatingButtons';
import type { AppProps } from 'next/app';
import '@/styles/globals.css';

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // FloatingButtons only renders on the homepage (see FloatingButtons.tsx) —
  // a fixed bottom-6 right-6 stack of two 48px circles (96px + 12px gap =
  // 132px tall from the viewport edge) there. ScrollToTop is pushed above it
  // only on that same page; everywhere else it can sit at the normal corner.
  const scrollToTopPosition = router.pathname === '/' ? 'bottom-40 sm:bottom-44 right-6' : 'bottom-6 right-6';

  return (
    <>
      <Head>
        <style>{`
          @font-face {
            font-family: 'GL-Kirovi';
            src: url('/fonts/gl-kirovi-bold-39756223608.ttf') format('truetype');
            font-weight: bold;
            font-style: normal;
            font-display: swap;
          }
          
          /* ორიგინალური ფონტის პარამეტრები */
          html, body, button, input, select, textarea {
            font-family: 'GL-Kirovi', 'Fira GO', sans-serif !important;
            letter-spacing: 0.05em !important;
            line-height: 1.6 !important;
          }

          /* სათაურის ხაზებს შორის დაშორება */
          h1, h2, h3 {
            letter-spacing: 0.05em !important;
            line-height: 1.65 !important;
          }

          /* ბლოკების (ქარდების) გაცოცხლება და ნეონის ცისფერი ნათება */
          .grid > div, 
          section#about .grid > div,
          section#courses .grid > div,
          section#blog .grid > div,
          section#about > div > div {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }

          .grid > div:hover,
          section#about .grid > div:hover,
          section#courses .grid > div:hover,
          section#blog .grid > div:hover {
            transform: translateY(-4px) scale(1.01) !important;
            border-color: #22d3ee !important;
            box-shadow: 0 10px 30px -5px rgba(34, 211, 238, 0.3) !important;
          }

          /* ყველა ღილაკის გაცოცხლება */
          button, 
          a.bg-slate-900, 
          a.bg-gradient-to-r,
          .bg-cyan-500,
          button.bg-gradient-to-r {
            transition: all 0.25s ease !important;
          }

          button:hover, 
          a.bg-slate-900:hover, 
          a.bg-gradient-to-r:hover {
            transform: translateY(-2px) !important;
            opacity: 0.95;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15) !important;
          }

          button:active, 
          a.bg-slate-900:active, 
          a.bg-gradient-to-r:active {
            transform: translateY(1px) !important;
          }
        `}</style>
      </Head>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <AuthProvider>
        <AuthModalProvider>
          <Component {...pageProps} />
          <ScrollToTop positionClassName={scrollToTopPosition} />
          <FloatingButtons />
          <AuthModal />
        </AuthModalProvider>
      </AuthProvider>
    </>
  );
}

export default appWithTranslation(App);