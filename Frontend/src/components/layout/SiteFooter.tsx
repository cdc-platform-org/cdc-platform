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
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/',
    icon: (
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    ),
  },
];

const STRINGS = {
  GEO: {
    tagline: 'ვასწავლით ციფრულ პროფესიებს გურიაში — HEKS/EPER Georgia-ს მხარდაჭერით.',
    coursesHeading: 'კურსები',
    courses: 'კურსები',
    cases: 'წარმატებული სტუდენტები',
    caseStudies: 'ქეისები',
    trainers: 'ტრენერები',
    gallery: 'ფოტოგალერეა',
    communityHeading: 'საზოგადოება',
    jobs: 'ვაკანსიები და პროექტები',
    mentors: 'მენტორები',
    forum: 'ფორუმი',
    marketplace: 'ციფრული მაღაზია',
    studio: 'CDC Studio',
    helpHeading: 'დახმარება',
    about: 'ჩვენ შესახებ',
    contactPage: 'დაგვიკავშირდით',
    legalHeading: 'სამართლებრივი',
    privacy: 'კონფიდენციალურობის პოლიტიკა',
    terms: 'წესები და პირობები',
    refund: 'თანხის დაბრუნების პოლიტიკა',
    rights: 'ყველა უფლება დაცულია.',
    followUs: 'გამოგვყევით',
    weAccept: 'მიიღება გადახდა',
  },
  ENG: {
    tagline: 'Teaching digital professions in Guria — supported by HEKS/EPER Georgia.',
    coursesHeading: 'Courses',
    courses: 'All Courses',
    cases: 'Success Stories',
    caseStudies: 'Case Studies',
    trainers: 'Trainers',
    gallery: 'Photo Gallery',
    communityHeading: 'Community',
    jobs: 'Jobs & Projects',
    mentors: 'Mentors',
    forum: 'Forum',
    marketplace: 'Marketplace',
    studio: 'CDC Studio',
    helpHeading: 'Help',
    about: 'About Us',
    contactPage: 'Get in Touch',
    legalHeading: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    refund: 'Refund Policy',
    rights: 'All rights reserved.',
    followUs: 'Follow Us',
    weAccept: 'We Accept',
  },
} as const;

// Shared hover-animated link style used across every column — slides
// right and shifts to cyan on hover so it reads as a single deliberate
// interaction language rather than a plain color change.
const navLink =
  'inline-block text-slate-400 hover:text-cyan-400 hover:translate-x-1 transition-all duration-200 no-underline';

export default function SiteFooter({ lang }: SiteFooterProps) {
  const t = STRINGS[lang];
  const year = new Date().getFullYear();

  const noHoverFx = 'outline-none hover:outline-none focus:outline-none border-none hover:border-none hover:shadow-none hover:ring-0';

  return (
    <footer className={`relative text-sm ${noHoverFx}`}>
      {/* SVG WAVE DIVIDER — sits on whatever page background precedes the
          footer (light or dark mode), so the curve reads correctly either
          way; the solid footer body below carries its own fixed gradient.
          `leading-none` + `block` on the svg removes the default inline
          baseline gap that would otherwise leave a hairline seam. */}
      <div className="w-full overflow-hidden leading-none" aria-hidden="true">
        <svg
          className="block w-full h-12 md:h-20 text-indigo-950 fill-current"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path d="M0,32L60,42.7C120,53,240,75,360,80C480,85,600,75,720,64C840,53,960,43,1080,48C1200,53,1320,75,1380,85.3L1440,96L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z" />
        </svg>
      </div>

      <div className={`bg-gradient-to-b from-indigo-950 via-slate-900 to-black text-slate-300 -mt-px ${noHoverFx}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 ${noHoverFx}`}>
          {/* Company — glassmorphism card with a soft glow behind the logo badge.
              Deliberately excluded from noHoverFx: this is the one footer
              element meant to react on hover (glowing border), unlike the
              plain text/link blocks around it. */}
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 transition-colors duration-300 hover:border-cyan-400/50">
            <div className={`flex items-center gap-2.5 mb-3 ${noHoverFx}`}>
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/40 blur-xl rounded-lg" aria-hidden="true" />
                <div className="relative bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-3 py-1.5 rounded-lg font-black text-sm tracking-wider shadow-lg">
                  CDC
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-400 mb-4">{t.tagline}</p>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">{t.followUs}</h3>
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-indigo-900 transition-all shadow-lg flex items-center justify-center text-slate-300 no-underline"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Courses */}
          <div className={noHoverFx}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200 mb-4">{t.coursesHeading}</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/courses" className={navLink}>{t.courses}</Link></li>
              <li><Link href="/success-stories" className={navLink}>{t.cases}</Link></li>
              <li><Link href="/trainers" className={navLink}>{t.trainers}</Link></li>
              <li><Link href="/gallery" className={navLink}>{t.gallery}</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div className={noHoverFx}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200 mb-4">{t.communityHeading}</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/community" className={navLink}>{t.jobs}</Link></li>
              <li><Link href="/mentors" className={navLink}>{t.mentors}</Link></li>
              <li><Link href="/marketplace" className={navLink}>{t.marketplace}</Link></li>
              <li><Link href="/forum" className={navLink}>{t.forum}</Link></li>
              <li><Link href="/agency" className={navLink}>{t.studio}</Link></li>
              <li><Link href="/cases" className={navLink}>{t.caseStudies}</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div className={noHoverFx}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200 mb-4">{t.helpHeading}</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/about" className={navLink}>{t.about}</Link></li>
              <li><Link href="/contact" className={navLink}>{t.contactPage}</Link></li>
              <li>
                <a href={`mailto:${merchantInfo.email}`} className={navLink}>
                  {merchantInfo.email}
                </a>
              </li>
              <li>
                <a href={`tel:${merchantInfo.phone.replace(/\s+/g, '')}`} className={navLink}>
                  {merchantInfo.phone}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className={noHoverFx}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-200 mb-4">{t.legalHeading}</h3>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/privacy" className={navLink}>{t.privacy}</Link></li>
              <li><Link href="/terms" className={navLink}>{t.terms}</Link></li>
              <li><Link href="/refund-policy" className={navLink}>{t.refund}</Link></li>
            </ul>
          </div>
        </div>

        {/* Payment method badges — Bank of Georgia merchant compliance:
            accepted card networks must be visibly listed on the site.
            Grouped in their own flex-wrap container so they wrap as a unit
            onto the next line together (below the label) on narrow
            screens, instead of each badge wrapping independently. */}
        <div className={`border-t border-white/10 ${noHoverFx}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">{t.weAccept}</span>
            <div className="flex flex-wrap items-center gap-2">
              {['VISA', 'Mastercard', 'BOG Pay'].map((method) => (
                <span
                  key={method}
                  className="text-[11px] font-bold text-slate-200 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 whitespace-nowrap"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Merchant / legal-entity compliance block — always bilingual regardless
            of the page's language toggle, since this is compliance identity
            information (Bank of Georgia merchant requirement), not UI copy. */}
        <div className={`border-t border-white/10 ${noHoverFx}`}>
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
          </div>
        </div>

        {/* Clean bottom bar — centered copyright, with generous bottom
            clearance so it never sits under the fixed bottom-right
            floating buttons (WhatsApp / AI bot / scroll-to-top) on mobile
            or desktop. */}
        <div className={`border-t border-white/10 ${noHoverFx}`}>
          <p className="max-w-7xl mx-auto px-6 pt-6 pb-16 md:pb-20 text-center text-[11px] text-slate-600">
            © {year} {lang === 'GEO' ? merchantInfo.orgNameKa : merchantInfo.orgNameEn}. {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
