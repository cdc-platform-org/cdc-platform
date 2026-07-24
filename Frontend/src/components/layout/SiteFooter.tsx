import Link from 'next/link';
import { merchantInfo } from '@/src/data/merchantInfo';

interface SiteFooterProps {
  // Matches the local 'GEO' | 'ENG' language-toggle state already used by
  // the marketing pages (index.tsx, agency.tsx, community.tsx) — none of
  // them use next-i18next/router.locale, so the footer takes this as a
  // prop instead of reading router.locale itself.
  lang: 'GEO' | 'ENG';
}

const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/cdc.digitalcareers',
    icon: (
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/digitalcareers1/',
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="6.6" r="1.2" />
      </>
    ),
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@digitalcareers.geo',
    icon: (
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17c1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97c-.57-.26-1.1-.59-1.62-.93c-.01 2.92.01 5.84-.02 8.75c-.08 1.4-.54 2.79-1.35 3.94c-1.31 1.92-3.58 3.17-5.91 3.21c-1.43.08-2.86-.31-4.08-1.03c-2.02-1.19-3.44-3.37-3.65-5.71c-.02-.5-.03-1-.01-1.49c.18-1.9 1.12-3.72 2.58-4.96c1.66-1.44 3.98-2.13 6.15-1.72c.02 1.48-.04 2.96-.04 4.44c-.99-.32-2.15-.23-3.02.37c-.63.41-1.11 1.04-1.36 1.75c-.21.51-.15 1.07-.14 1.61c.24 1.64 1.82 3.02 3.5 2.87c1.12-.01 2.19-.66 2.77-1.61c.19-.33.4-.67.41-1.06c.1-1.79.06-3.57.07-5.36c.01-4.03-.01-8.05.02-12.07Z" />
    ),
  },
];

const STRINGS = {
  GEO: {
    tagline: 'ვასწავლით ციფრულ პროფესიებს გურიაში — HEKS/EPER Georgia-ს მხარდაჭერით.',
    linksHeading: 'გვერდები',
    about: 'ჩვენ შესახებ',
    courses: 'კურსები',
    forum: 'ფორუმი',
    studio: 'CDC Studio',
    legalHeading: 'სამართლებრივი',
    privacy: 'კონფიდენციალურობის პოლიტიკა',
    terms: 'წესები და პირობები',
    refund: 'თანხის დაბრუნების პოლიტიკა',
    contactHeading: 'კონტაქტი',
    rights: 'ყველა უფლება დაცულია.',
    followUs: 'გამოგვყევით',
  },
  ENG: {
    tagline: 'Teaching digital professions in Guria — supported by HEKS/EPER Georgia.',
    linksHeading: 'Pages',
    about: 'About Us',
    courses: 'Courses',
    forum: 'Forum',
    studio: 'CDC Studio',
    legalHeading: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    refund: 'Refund Policy',
    contactHeading: 'Contact',
    rights: 'All rights reserved.',
    followUs: 'Follow Us',
  },
} as const;

export default function SiteFooter({ lang }: SiteFooterProps) {
  const t = STRINGS[lang];
  const year = new Date().getFullYear();

  const noHoverFx = 'outline-none hover:outline-none focus:outline-none border-none hover:border-none hover:shadow-none hover:ring-0';

  return (
    <footer className={`border-t bg-slate-900 border-slate-800 text-slate-400 text-sm ${noHoverFx}`}>
      <div className={`max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 ${noHoverFx}`}>
        {/* Brand */}
        <div className={noHoverFx}>
          <div className={`flex items-center gap-2.5 mb-3 ${noHoverFx}`}>
            <div className={`bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-3 py-1.5 rounded-lg font-black text-sm tracking-wider ${noHoverFx}`}>
              CDC
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 mb-4">{t.tagline}</p>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">{t.followUs}</h3>
          <div className="flex items-center gap-2.5">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition-colors no-underline"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  {social.icon}
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className={noHoverFx}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.linksHeading}</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/about" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.about}</Link></li>
            <li><Link href="/courses" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.courses}</Link></li>
            <li><Link href="/forum" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.forum}</Link></li>
            <li><Link href="/agency" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.studio}</Link></li>
          </ul>
        </div>

        {/* Legal links */}
        <div className={noHoverFx}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.legalHeading}</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/privacy" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.privacy}</Link></li>
            <li><Link href="/terms" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.terms}</Link></li>
            <li><Link href="/refund-policy" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.refund}</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div className={noHoverFx}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.contactHeading}</h3>
          <ul className="space-y-2.5 text-xs">
            <li>
              <a href={`mailto:${merchantInfo.email}`} className="hover:text-cyan-400 transition-colors no-underline text-current">
                {merchantInfo.email}
              </a>
            </li>
            <li>
              <a href={`tel:${merchantInfo.phone.replace(/\s+/g, '')}`} className="hover:text-cyan-400 transition-colors no-underline text-current">
                {merchantInfo.phone}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Merchant / legal-entity compliance block — always bilingual regardless
          of the page's language toggle, since this is compliance identity
          information (Bank of Georgia merchant requirement), not UI copy. */}
      <div className={`border-t border-slate-800 ${noHoverFx}`}>
        <div className={`max-w-7xl mx-auto px-6 py-6 text-[11px] leading-relaxed text-slate-500 space-y-1 ${noHoverFx}`}>
          <p className="text-slate-400 font-semibold">
            {merchantInfo.orgNameKa} / {merchantInfo.orgNameEn}
          </p>
          <p>
            ს/კ / ID Code: {merchantInfo.identificationCode}
          </p>
          <p>
            {merchantInfo.addressKa} / {merchantInfo.addressEn}
          </p>
          <p className="pt-2 text-slate-600">
            © {year} {lang === 'GEO' ? merchantInfo.orgNameKa : merchantInfo.orgNameEn}. {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
