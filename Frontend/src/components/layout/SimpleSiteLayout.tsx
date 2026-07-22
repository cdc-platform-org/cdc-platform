import { useState, ReactNode } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import SiteFooter from './SiteFooter';

interface SimpleSiteLayoutProps {
  titleKa: string;
  titleEn: string;
  // Render-prop so the page body can translate its own content using the
  // same lang state that drives the nav toggle and SiteFooter.
  children: (lang: 'GEO' | 'ENG') => ReactNode;
}

// Lightweight shared shell (logo + language toggle + SiteFooter) for
// content-only pages — /about, /privacy, /terms, /refund-policy — that don't
// need the homepage's full nav (search bar, mobile menu, chat assistant).
export default function SimpleSiteLayout({ titleKa, titleEn, children }: SimpleSiteLayoutProps) {
  const [lang, setLang] = useState<'GEO' | 'ENG'>('GEO');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Head>
        <title>{lang === 'GEO' ? titleKa : titleEn} | CDC</title>
      </Head>

      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-current">
            <Image
              src="/images/cdc-logo.png"
              alt={lang === 'GEO' ? 'CDC ლოგო' : 'CDC Logo'}
              width={44}
              height={44}
              className="h-10 w-auto rounded-xl object-cover"
            />
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === 'GEO' ? 'ENG' : 'GEO')}
            className="font-black text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-cyan-400 cursor-pointer"
          >
            {lang}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">{children(lang)}</main>

      <SiteFooter lang={lang} />
    </div>
  );
}
