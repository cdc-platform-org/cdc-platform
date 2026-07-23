import Link from 'next/link';
import { merchantInfo } from '@/src/data/merchantInfo';

interface SiteFooterProps {
  // Matches the local 'GEO' | 'ENG' language-toggle state already used by
  // the marketing pages (index.tsx, agency.tsx, community.tsx) — none of
  // them use next-i18next/router.locale, so the footer takes this as a
  // prop instead of reading router.locale itself.
  lang: 'GEO' | 'ENG';
}

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
          <p className="text-xs leading-relaxed text-slate-500">{t.tagline}</p>
        </div>

        {/* Quick links */}
        <div className={noHoverFx}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">{t.linksHeading}</h3>
          <ul className="space-y-2.5 text-xs">
            <li><Link href="/about" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.about}</Link></li>
            <li><Link href="/courses" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.courses}</Link></li>
            <li><Link href="/community" className="hover:text-cyan-400 transition-colors no-underline text-current">{t.forum}</Link></li>
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
