import { useState } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Link from 'next/link';
import {
  Bot,
  MessageSquareText,
  BookOpen,
  Code2,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Users,
  Sparkles,
  Lock,
  Building2,
  X,
  Download,
  EyeOff,
  Info,
  KeyRound,
  Mic,
  Crown,
} from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import CyberSentinelWaitlistModal from '../src/components/tools/CyberSentinelWaitlistModal';
import ProductOverviewCard from '../src/components/tools/ProductOverviewCard';
import { PRODUCT_OVERVIEW } from '../src/data/productOverviews';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';
import { resolveLocale } from '@/src/utils/locale';
import SEOHead from '@/src/components/seo/SEOHead';
import { buildSoftwareApplicationSchema } from '@/src/utils/seo';

// Real per-locale copy for all 9 site locales (not the 6-locale `dict`
// below, which still aliases de/es/fr/uk to English strings) — meta
// descriptions are short enough to translate properly for every locale
// rather than following that older fallback pattern.
const META_DESCRIPTION: Record<string, string> = {
  ka: 'გაეცანით CDC-ის AI ციფრულ ხელსაწყოებს — Enterprise AI ასისტენტი, საგამოცდო სისტემა, ხმისა და ვიდეოს სტუდია და სხვა, შექმნილი ბიზნესებისა და დამსაქმებლებისთვის.',
  en: "Explore CDC's AI-powered digital tools — Enterprise AI Assistant, Proctored Exams, Voice & Video Studio, and more, built for businesses and employers.",
  de: 'Entdecken Sie die KI-gestützten Tools von CDC — Enterprise AI Assistant, überwachte Prüfungen, Sprach- und Videostudio und mehr, entwickelt für Unternehmen und Arbeitgeber.',
  es: 'Descubre las herramientas digitales con IA de CDC — Asistente de IA empresarial, exámenes supervisados, estudio de voz y vídeo y más, creadas para empresas y empleadores.',
  fr: "Découvrez les outils numériques IA de CDC — Assistant IA d'entreprise, examens surveillés, studio voix et vidéo, et plus encore, conçus pour les entreprises et les employeurs.",
  uk: 'Ознайомтеся з цифровими AI-інструментами CDC — корпоративний AI-асистент, іспити з проктерингом, студія голосу та відео й інше, створені для бізнесу та роботодавців.',
  tr: "CDC'nin yapay zeka destekli dijital araçlarını keşfedin — Kurumsal AI Asistanı, gözetimli sınavlar, Ses ve Video Stüdyosu ve daha fazlası, işletmeler ve işverenler için tasarlandı.",
  hy: 'Բացահայտեք CDC-ի AI-ով աշխատող թվային գործիքները՝ կորպորատիվ AI օգնական, վերահսկվող քննություններ, ձայնի և տեսանյութի ստուդիա և ավելին՝ ստեղծված բիզնեսների և գործատուների համար։',
  az: 'CDC-nin süni intellekt əsaslı rəqəmsal alətlərini kəşf edin — Korporativ AI Assistenti, nəzarətli imtahanlar, Səs və Video Studiyası və digərləri, biznes və işəgötürənlər üçün hazırlanıb.',
};

const dict = {
  ka: {
    title: 'ციფრული ხელსაწყოები',
    subtitle: 'AI-ზე დაფუძნებული პროდუქტები, რომლებიც CDC-მ შექმნა ბიზნესებისა და დამსაქმებლებისთვის.',
    // Card 1 — Enterprise AI Assistant
    aiTitle: 'Enterprise AI ასისტენტი & ცოდნის ბაზა',
    aiDesc:
      'შექმენით საკუთარი AI ჩატბოტი თქვენი კომპანიისთვის — ის სწავლობს თქვენს ბიზნესზე და პასუხობს ვიზიტორებს თქვენი საიტიდან პირდაპირ.',
    aiBullet1: 'პერსონალიზებული AI ჩატბოტი თქვენი საიტისთვის',
    aiBullet2: 'საკუთარი ცოდნის ბაზა კითხვა-პასუხის ფორმატში',
    aiBullet3: 'ჩასაშენებელი ვიჯეტი — ერთი კოდი და მზადაა',
    aiBullet4: 'ვიზიტორთა საუბრების ანალიტიკა',
    aiCta: '7 დღე უფასოდ',
    aiAvailable: 'ხელმისაწვდომია',
    // Card 2 — Proctored Exam
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-ზე დაფუძნებული ონლაინ გამოცდები რეალურ დროში მონიტორინგით და კანდიდატების უნარების ავტომატური შეფასებით.',
    examBullet1: 'AI კითხვების გენერატორი — ნებისმიერი პოზიციისთვის',
    examBullet2: 'რეალურ დროში ქცევითი მონიტორინგი',
    examBullet3: 'ავტომატური უნარების შეფასების მატრიცა',
    examBullet4: '1-სტრიქონიანი ჩასაშენებელი კოდი',
    examCta: '10 დღე უფასოდ',
    // Card 3 — Candidate Screener
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'AI ასისტენტი, რომელიც დამსაქმებლებს ეხმარება კანდიდატების პირველად გადარჩევასა და HR პროცესების ავტომატიზაციაში.',
    // Card 4 — Cyber Sentinel AI
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'ავტონომიური AI კიბერ-უსაფრთხოების აგენტი თქვენი კომპიუტერისთვის. ამოიცნობს ჰაკერულ ქმედებებს პრევენციულად, ატარებს ავტომატურ სკანირებას და გიმზადებთ ყოველდღიურ AI ანგარიშს.',
    sentinelBullet1: 'ჩამოსატვირთი Desktop აგენტი (Windows & Mac)',
    sentinelBullet2: 'პროაქტიული ჰაკერული შეტევების ბლოკირება & AI ქცევითი ანალიზი',
    sentinelBullet3: 'ყოველდღიური AI ანგარიში და საფრთხეების მართვა',
    sentinelBullet4: 'პერსონალური მონაცემების გაჟონვისგან დაცვა',
    sentinelCta: 'ადრეული წვდომის მიღება',
    comingSoon: 'მალე',
    // Card 5 — AG-SAIA (pre-launch, informational card only — see
    // ProductOverviewCard's own "coming soon" posture: no live threat data
    // is ever shown until this is an actual running product).
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'სუვერენული AI უსაფრთხოების კვანძი — მალე',
    agsaiaDesc:
      'შემდეგი თაობის, სრულად სუვერენული AI უსაფრთხოების სისტემა — Zero-Knowledge Proof ავთენტიფიკაციითა და მოტყუების ტექნოლოგიით საფრთხეების პრევენციული აღმოსაჩენად.',
    agsaiaBullet1: 'Zero-Knowledge Proof ავთენტიფიკაცია',
    agsaiaBullet2: 'რეალურ დროში საფრთხეების დეტექცია',
    agsaiaBullet3: 'თაფლის ქოთანი (Honeypot) სატყუარა შეტევების მოსაზიდად',
    agsaiaBullet4: 'ყოველდღიური უსაფრთხოების ანგარიში',
    agsaiaContact: 'დაგვიკავშირდით განახლებებისთვის',
    learnMore: 'გაიგეთ მეტი',
    storeCta: 'ციფრული პროდუქტების მაღაზია',
    storeCtaDesc: 'UI Kits, AI Prompts, შაბლონები და ელექტრონული წიგნები.',
    storeCtaButton: 'მაღაზიის ნახვა',
    // Business-only gate modals for the AI Assistant trial CTA
    studentBlockedTitle: 'ხელმისაწვდომია მხოლოდ ბიზნეს ანგარიშებისთვის',
    studentBlockedDesc: 'ეს ინსტრუმენტები განკუთვნილია მხოლოდ ბიზნეს ანგარიშებისთვის. სტუდენტის/ფრილანსერის ანგარიშით მათი გამოყენება შეუძლებელია.',
    studentBlockedCta: 'გაიგეთ მეტი ბიზნეს ანგარიშის შესახებ',
    verificationRequiredTitle: 'საჭიროა ბიზნესის ვერიფიკაცია',
    verificationRequiredDesc: 'AI ხელსაწყოების გამოსაყენებლად საჭიროა თქვენი ბიზნეს ანგარიშის ვერიფიკაცია. გაიარეთ ვერიფიკაცია პირად კაბინეტში და სცადეთ ხელახლა.',
    verificationRequiredCta: 'ვერიფიკაციის გავლა',
    modalClose: 'დახურვა',
    poweredBy: 'Powered by CDC Studio',
  },
  en: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    examBullet1: 'AI question generator — for any role',
    examBullet2: 'Real-time behavioral proctoring',
    examBullet3: 'Automated skill assessment matrix',
    examBullet4: '1-line embed script',
    examCta: '10 Days Free',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    sentinelCta: 'Get Early Access',
    comingSoon: 'Coming Soon',
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'A sovereign AI security node — coming soon',
    agsaiaDesc:
      'A next-generation, fully sovereign AI security system — with Zero-Knowledge Proof authentication and deception technology to preventively detect threats.',
    agsaiaBullet1: 'Zero-Knowledge Proof authentication',
    agsaiaBullet2: 'Real-time threat detection',
    agsaiaBullet3: 'Honeypot-based threat luring',
    agsaiaBullet4: 'Daily security report',
    agsaiaContact: 'Contact us for updates',
    learnMore: 'Learn More',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
    poweredBy: 'Powered by CDC Studio',
  },
  de: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    examBullet1: 'AI question generator — for any role',
    examBullet2: 'Real-time behavioral proctoring',
    examBullet3: 'Automated skill assessment matrix',
    examBullet4: '1-line embed script',
    examCta: '10 Days Free',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    sentinelCta: 'Get Early Access',
    comingSoon: 'Coming Soon',
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'A sovereign AI security node — coming soon',
    agsaiaDesc:
      'A next-generation, fully sovereign AI security system — with Zero-Knowledge Proof authentication and deception technology to preventively detect threats.',
    agsaiaBullet1: 'Zero-Knowledge Proof authentication',
    agsaiaBullet2: 'Real-time threat detection',
    agsaiaBullet3: 'Honeypot-based threat luring',
    agsaiaBullet4: 'Daily security report',
    agsaiaContact: 'Contact us for updates',
    learnMore: 'Learn More',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
    poweredBy: 'Powered by CDC Studio',
  },
  es: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    examBullet1: 'AI question generator — for any role',
    examBullet2: 'Real-time behavioral proctoring',
    examBullet3: 'Automated skill assessment matrix',
    examBullet4: '1-line embed script',
    examCta: '10 Days Free',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    sentinelCta: 'Get Early Access',
    comingSoon: 'Coming Soon',
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'A sovereign AI security node — coming soon',
    agsaiaDesc:
      'A next-generation, fully sovereign AI security system — with Zero-Knowledge Proof authentication and deception technology to preventively detect threats.',
    agsaiaBullet1: 'Zero-Knowledge Proof authentication',
    agsaiaBullet2: 'Real-time threat detection',
    agsaiaBullet3: 'Honeypot-based threat luring',
    agsaiaBullet4: 'Daily security report',
    agsaiaContact: 'Contact us for updates',
    learnMore: 'Learn More',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
    poweredBy: 'Powered by CDC Studio',
  },
  fr: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    examBullet1: 'AI question generator — for any role',
    examBullet2: 'Real-time behavioral proctoring',
    examBullet3: 'Automated skill assessment matrix',
    examBullet4: '1-line embed script',
    examCta: '10 Days Free',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    sentinelCta: 'Get Early Access',
    comingSoon: 'Coming Soon',
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'A sovereign AI security node — coming soon',
    agsaiaDesc:
      'A next-generation, fully sovereign AI security system — with Zero-Knowledge Proof authentication and deception technology to preventively detect threats.',
    agsaiaBullet1: 'Zero-Knowledge Proof authentication',
    agsaiaBullet2: 'Real-time threat detection',
    agsaiaBullet3: 'Honeypot-based threat luring',
    agsaiaBullet4: 'Daily security report',
    agsaiaContact: 'Contact us for updates',
    learnMore: 'Learn More',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
    poweredBy: 'Powered by CDC Studio',
  },
  uk: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    examBullet1: 'AI question generator — for any role',
    examBullet2: 'Real-time behavioral proctoring',
    examBullet3: 'Automated skill assessment matrix',
    examBullet4: '1-line embed script',
    examCta: '10 Days Free',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    sentinelCta: 'Get Early Access',
    comingSoon: 'Coming Soon',
    agsaiaTitle: 'AG-SAIA — Sovereign AI Security',
    agsaiaTagline: 'A sovereign AI security node — coming soon',
    agsaiaDesc:
      'A next-generation, fully sovereign AI security system — with Zero-Knowledge Proof authentication and deception technology to preventively detect threats.',
    agsaiaBullet1: 'Zero-Knowledge Proof authentication',
    agsaiaBullet2: 'Real-time threat detection',
    agsaiaBullet3: 'Honeypot-based threat luring',
    agsaiaBullet4: 'Daily security report',
    agsaiaContact: 'Contact us for updates',
    learnMore: 'Learn More',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
    poweredBy: 'Powered by CDC Studio',
  },
};

export default function ToolsPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // The AI Voice & Video Media Studio card below is newly authored content
  // with real translations in all 9 site locales (not just the 6 this
  // page's own `dict` above covers) — a dedicated next-i18next namespace
  // gives it genuine tr/hy/az text instead of resolveLocale()'s English
  // fallback, without retranslating this file's older cards.
  const { t: tm } = useTranslation('mediaStudio');
  const { t: tEdu } = useTranslation('educatorHub');
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [infoModal, setInfoModal] = useState<'studentBlocked' | 'verificationRequired' | null>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [overviewModal, setOverviewModal] = useState<'enterpriseAi' | 'examProctoring' | 'agsaia' | null>(null);
  const overview = PRODUCT_OVERVIEW[lang];

  // Enterprise AI tools are Business-only, and only for a *verified* Business
  // account — SuperAdmin (internal staff) bypasses the verification check.
  const canUseAiAssistant =
    isAuthenticated && (user?.role === 'SuperAdmin' || (user?.role === 'Client' && user.isVerified));

  const handleAiCtaClick = () => {
    if (canUseAiAssistant) return;
    if (!isAuthenticated) {
      openAuthModal({ mode: 'register', initialRole: 'Client' });
      return;
    }
    if (user?.role !== 'Client') {
      setInfoModal('studentBlocked');
      return;
    }
    setInfoModal('verificationRequired');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SEOHead
        title={t.title}
        description={META_DESCRIPTION[router.locale ?? 'ka'] ?? META_DESCRIPTION.en}
        jsonLd={buildSoftwareApplicationSchema({
          type: 'SoftwareApplication',
          name: tm('catalogTitle'),
          description: tm('catalogDesc'),
          path: '/dashboard/tools/media-studio',
          applicationCategory: 'MultimediaApplication',
        })}
      />

      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            CDC AI
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-wide mb-3">{t.title}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{t.subtitle}</p>
          <a
            href="https://www.cdc.org.ge/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            {t.poweredBy}
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Enterprise AI Assistant — real, available product */}
          <div className="lg:col-span-3 rounded-3xl border border-cyan-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.aiTitle}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {t.aiAvailable}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.aiDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                {[
                  { icon: MessageSquareText, label: t.aiBullet1 },
                  { icon: BookOpen, label: t.aiBullet2 },
                  { icon: Code2, label: t.aiBullet3 },
                  { icon: BarChart3, label: t.aiBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                {canUseAiAssistant ? (
                  <Link
                    href="/dashboard/ai-tools"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t.aiCta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAiCtaClick}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t.aiCta}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOverviewModal('enterpriseAi')}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 bg-transparent border-none cursor-pointer hover:underline"
                >
                  <Info className="w-4 h-4" />
                  {t.learnMore}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: AI Proctored Exam — real, available product (activated
              alongside routes/examProctoring.ts + pages/exam/[token].tsx).
              Same Business-only gating as Card 1 (canUseAiAssistant), since
              it lives on the same /dashboard/ai-tools page. */}
          <div className="lg:col-span-3 rounded-3xl border border-cyan-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.examTitle}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {t.aiAvailable}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.examDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                {[
                  { icon: Sparkles, label: t.examBullet1 },
                  { icon: ShieldAlert, label: t.examBullet2 },
                  { icon: BarChart3, label: t.examBullet3 },
                  { icon: Code2, label: t.examBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                {canUseAiAssistant ? (
                  <Link
                    href="/dashboard/ai-tools"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t.examCta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAiCtaClick}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t.examCta}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOverviewModal('examProctoring')}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 bg-transparent border-none cursor-pointer hover:underline"
                >
                  <Info className="w-4 h-4" />
                  {t.learnMore}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2.5: AI Voice & Video Media Studio — real, available
              product, open to any logged-in user (not Business-gated like
              Cards 1/2 above, since it's a general productivity tool, not
              an enterprise feature) — the CTA links straight into
              ProtectedRoute, which handles the login redirect itself. */}
          <div className="lg:col-span-3 rounded-3xl border border-cyan-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{tm('catalogTitle')}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {t.aiAvailable}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{tm('catalogDesc')}</p>
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-5">{tm('catalogTag')}</p>
              <Link
                href="/dashboard/tools/media-studio"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                <Mic className="w-4 h-4" />
                {tm('catalogCta')}
              </Link>
            </div>
          </div>

          {/* Card 2.6: AI Educator VIP Hub — real, available product, same
              open-to-any-logged-in-user posture as Media Studio above (no
              dedicated Teacher role exists). VIP badge + 5-day trial hook
              replace the plain "Available now" pill Cards 1/2/2.5 use,
              since this one is paid — the page itself (not this card)
              handles trial-start/VIP-required/quota state. */}
          <div className="lg:col-span-3 rounded-3xl border border-amber-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-amber-500/5 to-purple-600/5 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{tEdu('pageTitle')}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {tEdu('vipBadge')}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{tEdu('pageSubtitle')}</p>
              <Link
                href="/dashboard/tools/educator-hub"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-amber-500/30 transition-all"
              >
                <Crown className="w-4 h-4" />
                {tEdu('trialCta')}
              </Link>
            </div>
          </div>

          {/* Card 3: AI Candidate Screener — coming soon */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 flex flex-col opacity-90">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" />
                {t.comingSoon}
              </span>
            </div>
            <h3 className="text-base font-black tracking-wide mb-2">{t.screenerTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.screenerDesc}</p>
          </div>

          {/* Card 4: Cyber Sentinel AI — coming soon, no desktop agent built
              yet (see Backend's CyberSentinelDevice model — schema
              placeholder only, no routes/UI wired to it). Bulleted like
              Card 1 since there's more to say than Cards 2/3's one-liner,
              but coming-soon-styled (muted icon, amber lock badge, no CTA)
              since nothing here is actually usable yet. */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.sentinelTitle}</h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  {t.comingSoon}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.sentinelDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Download, label: t.sentinelBullet1 },
                  { icon: ShieldAlert, label: t.sentinelBullet2 },
                  { icon: BarChart3, label: t.sentinelBullet3 },
                  { icon: EyeOff, label: t.sentinelBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowWaitlistModal(true)}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {t.sentinelCta}
                </button>
              </div>
            </div>
          </div>

          {/* Card 5: AG-SAIA — Sovereign AI Security. Pre-launch, same
              "Coming Soon" posture as Card 4: no ZKP handshake, threat
              detection, or honeypot exist yet, so this is purely
              informational (description + "Learn More" detail + a plain
              contact link) — never live status/telemetry, which would
              misrepresent an unbuilt product as an active security system. */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.agsaiaTitle}</h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  {t.comingSoon}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.agsaiaDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: KeyRound, label: t.agsaiaBullet1 },
                  { icon: ShieldAlert, label: t.agsaiaBullet2 },
                  { icon: EyeOff, label: t.agsaiaBullet3 },
                  { icon: BarChart3, label: t.agsaiaBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="mailto:contact@cdc.org.ge"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  <KeyRound className="w-4 h-4" />
                  {t.agsaiaContact}
                </a>
                <button
                  type="button"
                  onClick={() => setOverviewModal('agsaia')}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 bg-transparent border-none cursor-pointer hover:underline"
                >
                  <Info className="w-4 h-4" />
                  {t.learnMore}
                </button>
              </div>
            </div>
          </div>

          {/* Store — downloadable products (UI kits, prompts, templates), a
              separate concept from CDC's own SaaS products above. */}
          <Link
            href="/marketplace"
            className="lg:col-span-3 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 p-7 flex items-center justify-between gap-4 no-underline text-current hover:border-purple-400 transition-colors"
          >
            <div>
              <h3 className="text-base font-black tracking-wide mb-1">{t.storeCta}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.storeCtaDesc}</p>
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{t.storeCtaButton} →</span>
          </Link>
        </div>
      </div>

      <SiteFooter />

      {infoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setInfoModal(null)}>
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              aria-label={t.modalClose}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>

            {infoModal === 'studentBlocked' ? (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">{t.studentBlockedTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.studentBlockedDesc}</p>
                <Link
                  href="/contact"
                  onClick={() => setInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  {t.studentBlockedCta}
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">{t.verificationRequiredTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.verificationRequiredDesc}</p>
                <Link
                  href="/dashboard/client"
                  onClick={() => setInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  {t.verificationRequiredCta}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {showWaitlistModal && <CyberSentinelWaitlistModal lang={lang} onClose={() => setShowWaitlistModal(false)} />}

      {overviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8" onClick={() => setOverviewModal(null)}>
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-full overflow-y-auto p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOverviewModal(null)}
              aria-label={t.modalClose}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {overviewModal === 'enterpriseAi' ? (
              <ProductOverviewCard
                lang={lang}
                icon={Bot}
                title={t.aiTitle}
                tagline={t.aiDesc}
                {...overview.enterpriseAi}
              />
            ) : overviewModal === 'examProctoring' ? (
              <ProductOverviewCard
                lang={lang}
                icon={ShieldCheck}
                title={t.examTitle}
                tagline={t.examDesc}
                {...overview.examProctoring}
              />
            ) : (
              <ProductOverviewCard
                lang={lang}
                icon={KeyRound}
                title={t.agsaiaTitle}
                tagline={t.agsaiaTagline}
                {...overview.agsaia}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['mediaStudio', 'educatorHub'])) },
});
