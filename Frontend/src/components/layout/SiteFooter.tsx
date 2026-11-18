// Site-wide footer: brand + contacts, link columns, socials and the
// merchant-compliance strip. UI strings for all six languages live below.
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/router';
import { merchantInfo } from '@/src/data/merchantInfo';
import { NAV_DICT } from '@/src/data/siteNavigation';
import { AI_TOOLS_FILTER } from '@/src/data/productCategories';
import { resolveLocale } from '@/src/utils/locale';

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
  ka: {
    tagline: 'ვასწავლით ციფრულ პროფესიებს გურიაში — HEKS/EPER Georgia-ს მხარდაჭერით.',
    coursesHeading: 'ციფრული კოლეჯი',
    courses: 'კურსები',
    giftCards: 'სასაჩუქრე ბარათი',
    cases: 'წარმატებული სტუდენტები',
    caseStudies: 'ქეისები',
    trainers: 'ტრენერები',
    gallery: 'ფოტოგალერეა',
    communityHeading: 'საზოგადოება',
    jobs: 'ვაკანსიები და პროექტები',
    mentors: 'მენტორები',
    forum: 'ფორუმი',
    marketplace: 'ციფრული მარკეტი',
    studio: 'CDC Studio',
    helpHeading: 'დახმარება',
    tutorials: 'ვიდეო ტუტორიალები',
    about: 'ჩვენ შესახებ',
    contactPage: 'დაგვიკავშირდით',
    legalHeading: 'სამართლებრივი',
    privacy: 'კონფიდენციალურობის პოლიტიკა',
    terms: 'გამოყენების წესები და პირობები',
    refund: 'თანხის დაბრუნების პოლიტიკა',
    rights: 'ყველა უფლება დაცულია.',
    followUs: 'გამოგვყევით',
    weAccept: 'მიიღება გადახდა',
  },
  en: {
    tagline: 'Teaching digital professions in Guria — supported by HEKS/EPER Georgia.',
    coursesHeading: 'Digital College',
    courses: 'All Courses',
    giftCards: 'Gift cards',
    cases: 'Success Stories',
    caseStudies: 'Case Studies',
    trainers: 'Trainers',
    gallery: 'Photo Gallery',
    communityHeading: 'Community',
    jobs: 'Jobs & Projects',
    mentors: 'Mentors',
    forum: 'Forum',
    marketplace: 'Digital Market',
    studio: 'CDC Studio',
    helpHeading: 'Help',
    tutorials: 'Video Tutorials',
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
  de: {
    tagline: 'Wir unterrichten digitale Berufe in Guria — unterstützt von HEKS/EPER Georgia.',
    coursesHeading: 'Kurse',
    courses: 'Alle Kurse',
    giftCards: 'Geschenkkarten',
    cases: 'Erfolgsgeschichten',
    caseStudies: 'Fallstudien',
    trainers: 'Trainer',
    gallery: 'Fotogalerie',
    communityHeading: 'Community',
    jobs: 'Jobs & Projekte',
    mentors: 'Mentoren',
    forum: 'Forum',
    marketplace: 'Marktplatz',
    studio: 'CDC Studio',
    helpHeading: 'Hilfe',
    tutorials: 'Video-Tutorials',
    about: 'Über uns',
    contactPage: 'Kontakt',
    legalHeading: 'Rechtliches',
    privacy: 'Datenschutzrichtlinie',
    terms: 'Allgemeine Geschäftsbedingungen',
    refund: 'Rückerstattungsrichtlinie',
    rights: 'Alle Rechte vorbehalten.',
    followUs: 'Folgen Sie uns',
    weAccept: 'Wir akzeptieren',
  },
  es: {
    tagline: 'Enseñamos profesiones digitales en Guria — con el apoyo de HEKS/EPER Georgia.',
    coursesHeading: 'Cursos',
    courses: 'Todos los Cursos',
    giftCards: 'Tarjetas regalo',
    cases: 'Historias de Éxito',
    caseStudies: 'Casos de Estudio',
    trainers: 'Formadores',
    gallery: 'Galería de Fotos',
    communityHeading: 'Comunidad',
    jobs: 'Empleos y Proyectos',
    mentors: 'Mentores',
    forum: 'Foro',
    marketplace: 'Mercado',
    studio: 'CDC Studio',
    helpHeading: 'Ayuda',
    tutorials: 'Video Tutoriales',
    about: 'Sobre Nosotros',
    contactPage: 'Contáctanos',
    legalHeading: 'Legal',
    privacy: 'Política de Privacidad',
    terms: 'Términos y Condiciones',
    refund: 'Política de Reembolso',
    rights: 'Todos los derechos reservados.',
    followUs: 'Síguenos',
    weAccept: 'Aceptamos',
  },
  fr: {
    tagline: 'Nous enseignons les métiers numériques en Gourie — avec le soutien de HEKS/EPER Georgia.',
    coursesHeading: 'Cours',
    courses: 'Tous les cours',
    giftCards: 'Cartes cadeaux',
    cases: 'Témoignages de réussite',
    caseStudies: 'Études de cas',
    trainers: 'Formateurs',
    gallery: 'Galerie photo',
    communityHeading: 'Communauté',
    jobs: 'Emplois & Projets',
    mentors: 'Mentors',
    forum: 'Forum',
    marketplace: 'Marché',
    studio: 'CDC Studio',
    helpHeading: 'Aide',
    tutorials: 'Tutoriels vidéo',
    about: 'À propos de nous',
    contactPage: 'Contactez-nous',
    legalHeading: 'Mentions légales',
    privacy: 'Politique de confidentialité',
    terms: 'Conditions générales',
    refund: 'Politique de remboursement',
    rights: 'Tous droits réservés.',
    followUs: 'Suivez-nous',
    weAccept: 'Nous acceptons',
  },
  uk: {
    tagline: 'Ми навчаємо цифрових професій у Гурії — за підтримки HEKS/EPER Georgia.',
    coursesHeading: 'Курси',
    courses: 'Усі курси',
    giftCards: 'Подарункові картки',
    cases: 'Історії успіху',
    caseStudies: 'Кейси',
    trainers: 'Тренери',
    gallery: 'Фотогалерея',
    communityHeading: 'Спільнота',
    jobs: 'Вакансії та проєкти',
    mentors: 'Ментори',
    forum: 'Форум',
    marketplace: 'Маркетплейс',
    studio: 'CDC Studio',
    helpHeading: 'Допомога',
    tutorials: 'Відеоуроки',
    about: 'Про нас',
    contactPage: "Зв'язатися з нами",
    legalHeading: 'Правова інформація',
    privacy: 'Політика конфіденційності',
    terms: 'Умови використання',
    refund: 'Політика повернення коштів',
    rights: 'Усі права захищено.',
    followUs: 'Слідкуйте за нами',
    weAccept: 'Ми приймаємо',
  },
} as const;

// 2026-11 redesign: light, card-style footer (Figma e-learning template
// inspiration) built on the cdc-* tokens from tailwind.config.js, so the
// same markup serves dark mode. Content and the Bank of Georgia merchant
// compliance blocks (payment badges, legal entity, ID code) are unchanged.
const navLink =
  'inline-block py-1.5 sm:py-0 text-cdc-muted hover:text-cdc-primary-ink transition-colors duration-150 no-underline';
const headingClass = 'text-sm font-bold text-cdc-ink mb-4';
const listClass = 'space-y-1 sm:space-y-2.5 text-sm';

export default function SiteFooter() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = STRINGS[lang];
  const year = new Date().getFullYear();

  return (
    // -mx-4 sm:-mx-6 cancels _app.tsx's app-shell px-4 sm:px-6 so the footer
    // runs edge to edge (same full-bleed trick as SiteHeader's <nav>).
    <footer className="relative -mx-4 sm:-mx-6 mt-16 border-t border-cdc-border bg-cdc-surface text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-10 sm:gap-10">
        {/* Brand, contacts */}
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline" aria-label="CDC">
            <Image src="/images/cdc-logo.png" alt="CDC" width={44} height={44} className="h-11 w-11 rounded-xl object-cover ring-1 ring-cdc-border" />
            <span className="font-black text-base tracking-tight text-cdc-ink">CDC</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-cdc-muted">{t.tagline}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`mailto:${merchantInfo.email}`} className={`${navLink} inline-flex items-center gap-2`}>
                <Mail className="w-4 h-4 text-cdc-primary-ink" aria-hidden="true" />
                {merchantInfo.email}
              </a>
            </li>
            <li>
              <a href={`tel:${merchantInfo.phone.replace(/\s+/g, '')}`} className={`${navLink} inline-flex items-center gap-2`}>
                <Phone className="w-4 h-4 text-cdc-primary-ink" aria-hidden="true" />
                {merchantInfo.phone}
              </a>
            </li>
          </ul>
        </div>

        {/* Courses */}
        <div>
          <h3 className={headingClass}>{t.coursesHeading}</h3>
          <ul className={listClass}>
            <li><Link href="/courses" className={navLink}>{t.courses}</Link></li>
            <li><Link href="/gift-cards" className={navLink}>🎁 {t.giftCards}</Link></li>
            <li><Link href="/success-stories" className={navLink}>{t.cases}</Link></li>
            <li><Link href="/trainers" className={navLink}>{t.trainers}</Link></li>
            <li><Link href="/gallery" className={navLink}>{t.gallery}</Link></li>
          </ul>
        </div>

        {/* Community */}
        <div>
          <h3 className={headingClass}>{t.communityHeading}</h3>
          <ul className={listClass}>
            <li><Link href="/community" className={navLink}>{t.jobs}</Link></li>
            <li><Link href="/mentors" className={navLink}>{t.mentors}</Link></li>
            <li><Link href="/marketplace" className={navLink}>{t.marketplace}</Link></li>
            <li><Link href={`/marketplace?category=${AI_TOOLS_FILTER}`} className={navLink}>{NAV_DICT[lang].items.aiToolsLink.title}</Link></li>
            <li><Link href="/forum" className={navLink}>{t.forum}</Link></li>
            <li><Link href="/agency" className={navLink}>{t.studio}</Link></li>
            <li><Link href="/cases" className={navLink}>{t.caseStudies}</Link></li>
          </ul>
        </div>

        {/* Help */}
        <div>
          <h3 className={headingClass}>{t.helpHeading}</h3>
          <ul className={listClass}>
            <li><Link href="/tutorials" className={navLink}>{t.tutorials}</Link></li>
            <li><Link href="/about" className={navLink}>{t.about}</Link></li>
            <li><Link href="/contact" className={navLink}>{t.contactPage}</Link></li>
          </ul>
        </div>

        {/* Legal + socials */}
        <div>
          <h3 className={headingClass}>{t.legalHeading}</h3>
          <ul className={listClass}>
            <li><Link href="/privacy" className={navLink}>{t.privacy}</Link></li>
            <li><Link href="/terms" className={navLink}>{t.terms}</Link></li>
            <li><Link href="/refund-policy" className={navLink}>{t.refund}</Link></li>
          </ul>
          <h3 className={`${headingClass} mt-6`}>{t.followUs}</h3>
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className="w-10 h-10 rounded-xl border border-cdc-border bg-cdc-bg text-cdc-ink hover:bg-cdc-primary hover:border-cdc-primary hover:text-white transition-colors flex items-center justify-center no-underline"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  {social.icon}
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Payment method badges — Bank of Georgia merchant compliance:
          accepted card networks must be visibly listed on the site. */}
      <div className="border-t border-cdc-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-cdc-muted shrink-0">{t.weAccept}</span>
            {['VISA', 'Mastercard', 'BOG Pay'].map((method) => (
              <span
                key={method}
                className="text-[11px] font-bold text-cdc-ink bg-cdc-bg border border-cdc-border rounded-lg px-3 py-1.5 whitespace-nowrap"
              >
                {method}
              </span>
            ))}
          </div>
          {/* Merchant / legal-entity compliance block — always bilingual
              regardless of the page language (Bank of Georgia requirement). */}
          <div className="text-[11px] leading-relaxed text-cdc-muted sm:text-right">
            <p className="font-semibold text-cdc-ink">
              {merchantInfo.orgNameKa} / {merchantInfo.orgNameEn}
            </p>
            <p>ს/კ / ID Code: {merchantInfo.identificationCode}</p>
          </div>
        </div>
      </div>

      {/* Bottom bar — extra bottom padding keeps the copyright clear of the
          fixed floating buttons (WhatsApp / AI bot / scroll-to-top). */}
      <div className="border-t border-cdc-border">
        <p className="max-w-7xl mx-auto px-6 pt-5 pb-16 md:pb-20 text-center text-xs text-cdc-muted">
          © {year} {lang === 'ka' ? merchantInfo.orgNameKa : merchantInfo.orgNameEn}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
