import {
  GraduationCap,
  Video,
  Sparkles,
  PlayCircle,
  BookOpen,
  Palette,
  ShoppingBag,
  Briefcase,
  Users,
  Building2,
  MessagesSquare,
  Info,
  UserSquare2,
  UsersRound,
  GalleryHorizontal,
  Mail,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import type { SupportedLocale } from '../utils/locale';
import { MARKETPLACE_CATEGORIES } from './marketplaceCategories';

// Single source of truth for the public site navigation. Both the shared
// SiteHeader (all content pages) and the homepage use it, so the menu is
// identical everywhere instead of two hand-maintained link lists drifting
// apart.
//
// Information architecture:
//  - "AI tools" (/tools) = things you USE online on the platform.
//  - "Shop" (/marketplace) = things you BUY and download (e-books, design
//    assets...). The marketplace's own "Digital AI Tools" filter chip still
//    exists on the listing page, but it is deliberately NOT repeated in the
//    Shop dropdown: that duplicate is what made "Digital store" and "Digital
//    tools" look like the same thing.

export type NavItemKey =
  | 'courses' | 'liveTrainings' | 'careerTest' | 'tutorials'
  | 'ebooks' | 'designAssets' | 'allProducts' | 'aiToolsLink'
  | 'jobs' | 'mentors' | 'studio' | 'forum'
  | 'aboutCenter' | 'trainers' | 'team' | 'gallery' | 'contact';

export type NavGroupKey = 'learn' | 'shop' | 'career' | 'about';

export interface NavItem {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  kind: 'group';
  key: NavGroupKey;
  href: string;
  items: NavItem[];
}

export interface NavLink {
  kind: 'link';
  key: 'aiTools' | 'blog';
  href: string;
  highlight?: boolean;
}

export type NavEntry = NavGroup | NavLink;

const cat = (index: number, locale: SupportedLocale) => {
  const value = MARKETPLACE_CATEGORIES[index].value;
  return `/marketplace?category=${encodeURIComponent(locale === 'ka' ? value.ka : value.en)}`;
};

export function getSiteNavigation(locale: SupportedLocale): NavEntry[] {
  return [
    {
      kind: 'group',
      key: 'learn',
      href: '/courses',
      items: [
        { key: 'courses', href: '/courses', icon: GraduationCap },
        { key: 'liveTrainings', href: '/live-trainings', icon: Video },
        { key: 'careerTest', href: '/career-test', icon: Sparkles },
        { key: 'tutorials', href: '/tutorials', icon: PlayCircle },
      ],
    },
    { kind: 'link', key: 'aiTools', href: '/tools', highlight: true },
    {
      kind: 'group',
      key: 'shop',
      href: '/marketplace',
      items: [
        { key: 'ebooks', href: cat(1, locale), icon: BookOpen },
        { key: 'designAssets', href: cat(2, locale), icon: Palette },
        { key: 'allProducts', href: '/marketplace', icon: ShoppingBag },
        { key: 'aiToolsLink', href: '/tools', icon: Wand2 },
      ],
    },
    {
      kind: 'group',
      key: 'career',
      href: '/community',
      items: [
        { key: 'jobs', href: '/community', icon: Briefcase },
        { key: 'mentors', href: '/mentors', icon: Users },
        { key: 'studio', href: '/agency', icon: Building2 },
        { key: 'forum', href: '/forum', icon: MessagesSquare },
      ],
    },
    { kind: 'link', key: 'blog', href: '/blog' },
    {
      kind: 'group',
      key: 'about',
      href: '/about',
      items: [
        { key: 'aboutCenter', href: '/about', icon: Info },
        { key: 'trainers', href: '/trainers', icon: UserSquare2 },
        { key: 'team', href: '/about#team', icon: UsersRound },
        { key: 'gallery', href: '/gallery', icon: GalleryHorizontal },
        { key: 'contact', href: '/contact', icon: Mail },
      ],
    },
  ];
}

type Copy = { title: string; desc: string };
export interface NavDict {
  groups: Record<NavGroupKey, string>;
  links: Record<NavLink['key'], string>;
  items: Record<NavItemKey, Copy>;
}

const ka: NavDict = {
  groups: { learn: 'სწავლა', shop: 'მაღაზია', career: 'კარიერა', about: 'ჩვენ შესახებ' },
  links: { aiTools: 'AI ხელსაწყოები', blog: 'ბლოგი' },
  items: {
    courses: { title: 'კურსები', desc: 'ონლაინ კურსები სერტიფიკატით' },
    liveTrainings: { title: 'ლაივ ტრენინგები', desc: 'პირდაპირი სესიები ტრენერთან' },
    careerTest: { title: 'AI კარიერული ტესტი', desc: 'გაიგე, რომელი პროფესია გიხდება' },
    tutorials: { title: 'ვიდეო ინსტრუქციები', desc: 'როგორ გამოიყენო პლატფორმა' },
    ebooks: { title: 'ელექტრონული წიგნები', desc: 'ჩამოტვირთე და წაიკითხე' },
    designAssets: { title: 'ლოგოები და დიზაინი', desc: 'ბანერები და საბეჭდი მასალები' },
    allProducts: { title: 'ყველა პროდუქტი', desc: 'მაღაზიის სრული კატალოგი' },
    aiToolsLink: { title: 'AI ხელსაწყოები', desc: 'ონლაინ სერვისები, რომლებსაც პლატფორმაზე იყენებ' },
    jobs: { title: 'ვაკანსიები', desc: 'სამუშაო და სტაჟირება' },
    mentors: { title: 'მენტორები', desc: 'ინდივიდუალური კონსულტაცია' },
    studio: { title: 'CDC სტუდიო', desc: 'ციფრული სერვისები ბიზნესისთვის' },
    forum: { title: 'ფორუმი', desc: 'კითხვები და განხილვები' },
    aboutCenter: { title: 'ცენტრის შესახებ', desc: 'ჩვენი მისია და ისტორია' },
    trainers: { title: 'ტრენერები', desc: 'ვინ გასწავლის' },
    team: { title: 'გუნდი', desc: 'ადამიანები CDC-ის უკან' },
    gallery: { title: 'გალერეა', desc: 'ფოტოები ღონისძიებებიდან' },
    contact: { title: 'კონტაქტი', desc: 'დაგვიკავშირდი' },
  },
};

const en: NavDict = {
  groups: { learn: 'Learn', shop: 'Shop', career: 'Career', about: 'About' },
  links: { aiTools: 'AI Tools', blog: 'Blog' },
  items: {
    courses: { title: 'Courses', desc: 'Online courses with certificates' },
    liveTrainings: { title: 'Live trainings', desc: 'Live sessions with a trainer' },
    careerTest: { title: 'AI Career Test', desc: 'Find the profession that fits you' },
    tutorials: { title: 'Video tutorials', desc: 'How to use the platform' },
    ebooks: { title: 'E-books', desc: 'Download and read' },
    designAssets: { title: 'Logos & design', desc: 'Banners and print assets' },
    allProducts: { title: 'All products', desc: 'The full shop catalog' },
    aiToolsLink: { title: 'AI Tools', desc: 'Online services you use on the platform' },
    jobs: { title: 'Jobs', desc: 'Jobs and internships' },
    mentors: { title: 'Mentors', desc: 'One-on-one guidance' },
    studio: { title: 'CDC Studio', desc: 'Digital services for business' },
    forum: { title: 'Forum', desc: 'Questions and discussions' },
    aboutCenter: { title: 'About the center', desc: 'Our mission and story' },
    trainers: { title: 'Trainers', desc: 'Who teaches you' },
    team: { title: 'Team', desc: 'The people behind CDC' },
    gallery: { title: 'Gallery', desc: 'Photos from our events' },
    contact: { title: 'Contact', desc: 'Get in touch' },
  },
};

const de: NavDict = {
  groups: { learn: 'Lernen', shop: 'Shop', career: 'Karriere', about: 'Über uns' },
  links: { aiTools: 'KI-Tools', blog: 'Blog' },
  items: {
    courses: { title: 'Kurse', desc: 'Online-Kurse mit Zertifikat' },
    liveTrainings: { title: 'Live-Trainings', desc: 'Live-Sitzungen mit Trainer' },
    careerTest: { title: 'KI-Karrieretest', desc: 'Finde den Beruf, der zu dir passt' },
    tutorials: { title: 'Video-Tutorials', desc: 'So nutzt du die Plattform' },
    ebooks: { title: 'E-Books', desc: 'Herunterladen und lesen' },
    designAssets: { title: 'Logos & Design', desc: 'Banner und Druckmaterialien' },
    allProducts: { title: 'Alle Produkte', desc: 'Der komplette Katalog' },
    aiToolsLink: { title: 'KI-Tools', desc: 'Online-Dienste auf der Plattform' },
    jobs: { title: 'Jobs', desc: 'Jobs und Praktika' },
    mentors: { title: 'Mentoren', desc: 'Persönliche Beratung' },
    studio: { title: 'CDC Studio', desc: 'Digitale Dienste für Unternehmen' },
    forum: { title: 'Forum', desc: 'Fragen und Diskussionen' },
    aboutCenter: { title: 'Über das Zentrum', desc: 'Unsere Mission und Geschichte' },
    trainers: { title: 'Trainer', desc: 'Wer dich unterrichtet' },
    team: { title: 'Team', desc: 'Die Menschen hinter CDC' },
    gallery: { title: 'Galerie', desc: 'Fotos von Veranstaltungen' },
    contact: { title: 'Kontakt', desc: 'Schreib uns' },
  },
};

const es: NavDict = {
  groups: { learn: 'Aprender', shop: 'Tienda', career: 'Carrera', about: 'Nosotros' },
  links: { aiTools: 'Herramientas IA', blog: 'Blog' },
  items: {
    courses: { title: 'Cursos', desc: 'Cursos en línea con certificado' },
    liveTrainings: { title: 'Formaciones en vivo', desc: 'Sesiones en directo con un formador' },
    careerTest: { title: 'Test de carrera IA', desc: 'Descubre la profesión ideal para ti' },
    tutorials: { title: 'Video tutoriales', desc: 'Cómo usar la plataforma' },
    ebooks: { title: 'Libros electrónicos', desc: 'Descarga y lee' },
    designAssets: { title: 'Logos y diseño', desc: 'Banners y material impreso' },
    allProducts: { title: 'Todos los productos', desc: 'El catálogo completo' },
    aiToolsLink: { title: 'Herramientas IA', desc: 'Servicios en línea de la plataforma' },
    jobs: { title: 'Empleos', desc: 'Empleos y prácticas' },
    mentors: { title: 'Mentores', desc: 'Orientación personalizada' },
    studio: { title: 'CDC Studio', desc: 'Servicios digitales para empresas' },
    forum: { title: 'Foro', desc: 'Preguntas y debates' },
    aboutCenter: { title: 'Sobre el centro', desc: 'Nuestra misión e historia' },
    trainers: { title: 'Formadores', desc: 'Quién te enseña' },
    team: { title: 'Equipo', desc: 'Las personas detrás de CDC' },
    gallery: { title: 'Galería', desc: 'Fotos de nuestros eventos' },
    contact: { title: 'Contacto', desc: 'Escríbenos' },
  },
};

const fr: NavDict = {
  groups: { learn: 'Apprendre', shop: 'Boutique', career: 'Carrière', about: 'À propos' },
  links: { aiTools: 'Outils IA', blog: 'Blog' },
  items: {
    courses: { title: 'Cours', desc: 'Cours en ligne avec certificat' },
    liveTrainings: { title: 'Formations en direct', desc: 'Sessions en direct avec un formateur' },
    careerTest: { title: 'Test de carrière IA', desc: 'Trouvez le métier qui vous correspond' },
    tutorials: { title: 'Tutoriels vidéo', desc: 'Comment utiliser la plateforme' },
    ebooks: { title: 'Livres numériques', desc: 'Téléchargez et lisez' },
    designAssets: { title: 'Logos et design', desc: 'Bannières et supports imprimés' },
    allProducts: { title: 'Tous les produits', desc: 'Le catalogue complet' },
    aiToolsLink: { title: 'Outils IA', desc: 'Services en ligne de la plateforme' },
    jobs: { title: 'Emplois', desc: 'Emplois et stages' },
    mentors: { title: 'Mentors', desc: 'Accompagnement individuel' },
    studio: { title: 'CDC Studio', desc: 'Services numériques pour les entreprises' },
    forum: { title: 'Forum', desc: 'Questions et discussions' },
    aboutCenter: { title: 'À propos du centre', desc: 'Notre mission et notre histoire' },
    trainers: { title: 'Formateurs', desc: 'Qui vous enseigne' },
    team: { title: 'Équipe', desc: "L'équipe derrière CDC" },
    gallery: { title: 'Galerie', desc: 'Photos de nos événements' },
    contact: { title: 'Contact', desc: 'Écrivez-nous' },
  },
};

const uk: NavDict = {
  groups: { learn: 'Навчання', shop: 'Магазин', career: "Кар'єра", about: 'Про нас' },
  links: { aiTools: 'AI-інструменти', blog: 'Блог' },
  items: {
    courses: { title: 'Курси', desc: 'Онлайн-курси з сертифікатом' },
    liveTrainings: { title: 'Живі тренінги', desc: 'Сесії наживо з тренером' },
    careerTest: { title: "AI тест кар'єри", desc: 'Дізнайся, яка професія тобі пасує' },
    tutorials: { title: 'Відеоуроки', desc: 'Як користуватися платформою' },
    ebooks: { title: 'Електронні книги', desc: 'Завантажуй і читай' },
    designAssets: { title: 'Логотипи та дизайн', desc: 'Банери та поліграфія' },
    allProducts: { title: 'Усі товари', desc: 'Повний каталог магазину' },
    aiToolsLink: { title: 'AI-інструменти', desc: 'Онлайн-сервіси на платформі' },
    jobs: { title: 'Вакансії', desc: 'Робота та стажування' },
    mentors: { title: 'Ментори', desc: 'Індивідуальні консультації' },
    studio: { title: 'CDC Studio', desc: 'Цифрові послуги для бізнесу' },
    forum: { title: 'Форум', desc: 'Питання та обговорення' },
    aboutCenter: { title: 'Про центр', desc: 'Наша місія та історія' },
    trainers: { title: 'Тренери', desc: 'Хто тебе навчає' },
    team: { title: 'Команда', desc: 'Люди, що стоять за CDC' },
    gallery: { title: 'Галерея', desc: 'Фото з наших подій' },
    contact: { title: 'Контакти', desc: 'Напиши нам' },
  },
};

export const NAV_DICT: Record<SupportedLocale, NavDict> = { ka, en, de, es, fr, uk };
