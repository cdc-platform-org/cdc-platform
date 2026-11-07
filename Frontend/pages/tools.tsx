import { useState, useEffect } from 'react';
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
  X,
  Download,
  EyeOff,
  Info,
  KeyRound,
  Mic,
  GraduationCap,
  Check,
  ArrowRight,
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
import { getSiteContent } from '@/src/services/siteContentService';
import { ToolCatalogContent } from '@/src/types/siteContent';
import { customToolEntries, findToolEntry, overrideText } from '@/src/utils/toolCatalog';
import { resolveBlogImageUrl } from '@/src/services/blogService';
import { onImageErrorFallback } from '@/src/utils/imageFallback';
import VideoEmbed, { parseVideoUrl } from '@/src/components/shared/VideoEmbed';
import type { LucideIcon } from 'lucide-react';
import type { ToolCatalogEntry } from '@/src/types/siteContent';
import { ToolIconTile, ToolChip, toolPrimaryButton, toolSecondaryButton, type ToolAccent } from '@/src/components/tools/ToolShell';

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
    title: 'AI ხელსაწყოები',
    subtitle: 'AI-ზე დაფუძნებული პროდუქტები, რომლებიც CDC-მ შექმნა ბიზნესებისა და დამსაქმებლებისთვის.',
    // Card 1 — Enterprise AI Assistant
    aiTitle: 'ბიზნეს AI ჩატბოტი და ცოდნის ბაზა',
    aiDesc:
      'შექმენით საკუთარი AI ჩატბოტი თქვენი კომპანიისთვის — ის სწავლობს თქვენს ბიზნესზე და პასუხობს ვიზიტორებს თქვენი საიტიდან პირდაპირ.',
    aiBullet1: 'პერსონალიზებული AI ჩატბოტი თქვენი საიტისთვის',
    aiBullet2: 'საკუთარი ცოდნის ბაზა კითხვა-პასუხის ფორმატში',
    aiBullet3: 'ჩასაშენებელი ვიჯეტი — ერთი კოდი და მზადაა',
    aiBullet4: 'ვიზიტორთა საუბრების ანალიტიკა',
    aiCta: '7 დღე უფასოდ',
    aiAvailable: 'ხელმისაწვდომია',
    // Card 2 — Proctored Exam
    examTitle: 'AI გამოცდა ზედამხედველობით',
    examDesc: 'AI-ზე დაფუძნებული ონლაინ გამოცდები რეალურ დროში მონიტორინგით და კანდიდატების უნარების ავტომატური შეფასებით.',
    examBullet1: 'AI კითხვების გენერატორი — ნებისმიერი პოზიციისთვის',
    examBullet2: 'რეალურ დროში ქცევითი მონიტორინგი',
    examBullet3: 'ავტომატური უნარების შეფასების მატრიცა',
    examBullet4: '1-სტრიქონიანი ჩასაშენებელი კოდი',
    examCta: '10 დღე უფასოდ',
    // Card 3 — Candidate Screener
    tutorTitle: 'IMIAKO — AI ინგლისურის რეპეტიტორი',
    tutorDesc: 'ინგლისური ნულიდან, ნაბიჯ-ნაბიჯ: A1 კურსი, კითხვა, წერა, გრამატიკა, ლექსიკა, მოსმენა და დიალოგი — ახსნილი ქართულად.',
    tutorBadge: 'უფასო საცდელი',
    tutorCta: 'სწავლის დაწყება',
    screenerTitle: 'AI კანდიდატების შერჩევა და HR ასისტენტი',
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
    availableHeading: 'ხელმისაწვდომია ახლა',
    comingSoonHeading: 'მალე დაემატება',
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
    proctoringLiveBadge: '🛡️ ლაივ · ბეტა',
    proctoringPracticeTitle: 'AI პროქტორინგის სავარჯიშო გამოცდა',
    proctoringPracticeDesc: 'შექმენით პერსონალური AI გამოცდა ნებისმიერ საგანში, ივარჯიშეთ რეალურ დროში მონიტორინგის ქვეშ და მიიღეთ მყისიერი კომპეტენციის ანგარიში.',
    proctoringPracticeCta: 'გამოცდის დაწყება',
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
    tutorTitle: 'IMIAKO — AI English Tutor',
    tutorDesc: 'English from zero, step by step: an A1 course plus reading, writing, grammar, vocabulary, listening and dialogue practice — explained in your language.',
    tutorBadge: 'Free trial',
    tutorCta: 'Start learning',
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
    availableHeading: 'Available now',
    comingSoonHeading: 'Coming soon',
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
    proctoringLiveBadge: '🛡️ LIVE · BETA',
    proctoringPracticeTitle: 'AI Proctored Practice Exam',
    proctoringPracticeDesc: 'Build a personalized AI exam on any subject, practice under real-time monitoring, and get an instant competency report.',
    proctoringPracticeCta: 'Start Exam',
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
    tutorTitle: 'IMIAKO — AI English Tutor',
    tutorDesc: 'English from zero, step by step: an A1 course plus reading, writing, grammar, vocabulary, listening and dialogue practice — explained in your language.',
    tutorBadge: 'Free trial',
    tutorCta: 'Start learning',
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
    availableHeading: 'Available now',
    comingSoonHeading: 'Coming soon',
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
    proctoringLiveBadge: '🛡️ LIVE · BETA',
    proctoringPracticeTitle: 'AI Proctored Practice Exam',
    proctoringPracticeDesc: 'Build a personalized AI exam on any subject, practice under real-time monitoring, and get an instant competency report.',
    proctoringPracticeCta: 'Start Exam',
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
    tutorTitle: 'IMIAKO — AI English Tutor',
    tutorDesc: 'English from zero, step by step: an A1 course plus reading, writing, grammar, vocabulary, listening and dialogue practice — explained in your language.',
    tutorBadge: 'Free trial',
    tutorCta: 'Start learning',
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
    availableHeading: 'Available now',
    comingSoonHeading: 'Coming soon',
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
    proctoringLiveBadge: '🛡️ LIVE · BETA',
    proctoringPracticeTitle: 'AI Proctored Practice Exam',
    proctoringPracticeDesc: 'Build a personalized AI exam on any subject, practice under real-time monitoring, and get an instant competency report.',
    proctoringPracticeCta: 'Start Exam',
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
    tutorTitle: 'IMIAKO — AI English Tutor',
    tutorDesc: 'English from zero, step by step: an A1 course plus reading, writing, grammar, vocabulary, listening and dialogue practice — explained in your language.',
    tutorBadge: 'Free trial',
    tutorCta: 'Start learning',
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
    availableHeading: 'Available now',
    comingSoonHeading: 'Coming soon',
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
    proctoringLiveBadge: '🛡️ LIVE · BETA',
    proctoringPracticeTitle: 'AI Proctored Practice Exam',
    proctoringPracticeDesc: 'Build a personalized AI exam on any subject, practice under real-time monitoring, and get an instant competency report.',
    proctoringPracticeCta: 'Start Exam',
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
    tutorTitle: 'IMIAKO — AI English Tutor',
    tutorDesc: 'English from zero, step by step: an A1 course plus reading, writing, grammar, vocabulary, listening and dialogue practice — explained in your language.',
    tutorBadge: 'Free trial',
    tutorCta: 'Start learning',
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
    availableHeading: 'Available now',
    comingSoonHeading: 'Coming soon',
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
    proctoringLiveBadge: '🛡️ LIVE · BETA',
    proctoringPracticeTitle: 'AI Proctored Practice Exam',
    proctoringPracticeDesc: 'Build a personalized AI exam on any subject, practice under real-time monitoring, and get an instant competency report.',
    proctoringPracticeCta: 'Start Exam',
  },
};

// Only site paths ("/...") and http(s) URLs are allowed as a custom card's
// button target; anything else (e.g. "javascript:") renders no button.
function safeToolHref(url?: string): string | null {
  const u = (url ?? '').trim();
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

interface CatalogCardData {
  key: string;
  icon: LucideIcon;
  accent: ToolAccent;
  title: string;
  badge?: string;
  comingSoon?: boolean;
  description: string;
  tag?: string;
  features: { icon: LucideIcon; label: string }[];
  imageUrl?: string;
  videoUrl?: string;
  cta?: { label: string; href?: string; onClick?: () => void; external?: boolean };
  onLearnMore?: () => void;
}

// Media area at the top of every catalog card, always the same 16:10 box so
// cards line up in the grid: the admin-set video or cover image
// (pages/admin/tools.tsx) when there is one, otherwise a soft brand panel
// with the tool's icon tile.
function CatalogCardMedia({ card }: { card: CatalogCardData }) {
  const video = card.videoUrl?.trim();
  if (video && parseVideoUrl(video)) {
    return (
      <div className="w-full">
        <VideoEmbed url={video} title={card.title} />
      </div>
    );
  }
  if (card.imageUrl && card.imageUrl.trim()) {
    return (
      <div className="w-full aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded CMS image on the API origin */}
        <img src={resolveBlogImageUrl(card.imageUrl)} alt={card.title} onError={onImageErrorFallback} loading="lazy" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`w-full aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${card.comingSoon ? 'from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-900' : 'from-cyan-50 via-white to-purple-50 dark:from-cyan-500/10 dark:via-slate-900 dark:to-purple-500/10'}`}>
      <div className={card.comingSoon ? 'opacity-70 grayscale-[30%]' : ''}>
        <ToolIconTile icon={card.icon} accent={card.accent} size="lg" />
      </div>
    </div>
  );
}

function CatalogCard({ card, learnMoreLabel, comingSoonLabel }: { card: CatalogCardData; learnMoreLabel: string; comingSoonLabel: string }) {
  const cta = card.cta;
  const ctaClass = `${card.comingSoon ? toolSecondaryButton : toolPrimaryButton} w-full`;
  return (
    <article className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-all">
      <CatalogCardMedia card={card} />
      <div className="p-5 md:p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2 min-h-[24px]">
          {card.comingSoon ? (
            <ToolChip tone="warning" icon={Lock}>{comingSoonLabel}</ToolChip>
          ) : (
            card.badge && <ToolChip tone="success">{card.badge}</ToolChip>
          )}
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-snug mb-2">{card.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-3">{card.description}</p>
        {card.tag && <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-3">{card.tag}</p>}
        {card.features.length > 0 && (
          <ul className="space-y-2 mb-5">
            {card.features.slice(0, 3).map(({ label }) => (
              <li key={label} className="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-2 flex flex-col gap-2">
          {cta && (cta.href ? (
            cta.external ? (
              <a href={cta.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>{cta.label} <ArrowRight className="w-4 h-4" aria-hidden /></a>
            ) : cta.href.startsWith('mailto:') ? (
              <a href={cta.href} className={ctaClass}>{cta.label} <ArrowRight className="w-4 h-4" aria-hidden /></a>
            ) : (
              <Link href={cta.href} className={ctaClass}>{cta.label} <ArrowRight className="w-4 h-4" aria-hidden /></Link>
            )
          ) : (
            <button type="button" onClick={cta.onClick} className={ctaClass}>{cta.label} <ArrowRight className="w-4 h-4" aria-hidden /></button>
          ))}
          {card.onLearnMore && (
            <button
              type="button"
              onClick={card.onLearnMore}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 bg-transparent border-none cursor-pointer py-2 hover:underline"
            >
              <Info className="w-4 h-4" aria-hidden />
              {learnMoreLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// Turns an admin-added /admin/tools entry (any slug with no hand-built
// card) into the same catalog card.
function customEntryCard(entry: ToolCatalogEntry, lang: 'ka' | 'en', i: number): CatalogCardData {
  const pick = (ka?: string, en?: string) => (lang === 'ka' ? ka || en : en || ka) ?? '';
  const features = (lang === 'ka' ? entry.featuresKa?.length ? entry.featuresKa : entry.featuresEn : entry.featuresEn?.length ? entry.featuresEn : entry.featuresKa) ?? [];
  const comingSoon = entry.status === 'COMING_SOON';
  const href = comingSoon ? null : safeToolHref(entry.linkUrl);
  const subtitle = pick(entry.subtitleKa, entry.subtitleEn);
  const description = pick(entry.descriptionKa, entry.descriptionEn);
  return {
    key: `custom-${entry.slug}-${i}`,
    icon: Sparkles,
    accent: 'cyan',
    title: pick(entry.titleKa, entry.titleEn),
    badge: pick(entry.badgeKa, entry.badgeEn) || undefined,
    comingSoon,
    description: [subtitle, description].filter(Boolean).join(' — '),
    tag: pick(entry.pricingLabelKa, entry.pricingLabelEn) || undefined,
    features: features.map((label) => ({ icon: Sparkles, label })),
    imageUrl: entry.imageUrl,
    videoUrl: entry.videoUrl,
    cta: href ? { label: lang === 'ka' ? 'გახსნა' : 'Open', href, external: /^https?:/i.test(href) } : undefined,
  };
}

// Admin-set feature bullets replace a card's default bullets when present.
function withFeatures(fallback: { icon: LucideIcon; label: string }[], cms: ToolCatalogEntry | undefined, lang: 'ka' | 'en') {
  const list = lang === 'ka' ? cms?.featuresKa : cms?.featuresEn;
  return list && list.length > 0 ? list.map((label) => ({ icon: Sparkles, label })) : fallback;
}

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
  const { t: tCB } = useTranslation('childrensBook');
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [overviewModal, setOverviewModal] = useState<'enterpriseAi' | 'examProctoring' | 'agsaia' | null>(null);
  const overview = PRODUCT_OVERVIEW[lang];

  // Admin-editable overrides for the Media Studio / Educator Hub / self-
  // service Proctoring cards below (pages/admin/tools.tsx) — same pattern
  // as marketplace/index.tsx's own toolCatalog fetch.
  const [toolCatalog, setToolCatalog] = useState<ToolCatalogContent | null>(null);
  useEffect(() => {
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => setToolCatalog(row?.content ?? {}))
      .catch(() => setToolCatalog({}));
  }, []);
  const catLang: 'ka' | 'en' = lang === 'ka' ? 'ka' : 'en';
  const mediaStudioCms = findToolEntry(toolCatalog?.tools, 'media-studio');
  const educatorHubCms = findToolEntry(toolCatalog?.tools, 'educator-hub');
  const proctoringCms = findToolEntry(toolCatalog?.tools, 'proctoring');
  const childrensBookCms = findToolEntry(toolCatalog?.tools, 'childrens-book');
  const englishTutorCms = findToolEntry(toolCatalog?.tools, 'english-tutor');
  const enterpriseAiCms = findToolEntry(toolCatalog?.tools, 'enterprise-ai');
  const examScreeningCms = findToolEntry(toolCatalog?.tools, 'exam-screening');
  const sentinelCms = findToolEntry(toolCatalog?.tools, 'cyber-sentinel');
  const agsaiaCms = findToolEntry(toolCatalog?.tools, 'ag-saia');
  const ov = (fallback: string, cms: ToolCatalogEntry | undefined, field: 'title' | 'description' | 'badge') =>
    overrideText(fallback, (cms?.[`${field}${catLang === 'ka' ? 'Ka' : 'En'}` as keyof ToolCatalogEntry] as string | undefined) ?? undefined);

  // Every AI tool is full-access for any approved account, regardless of
  // role or Business verification — the Employment Forum (forum.ts's
  // isVerifiedGraduate gate) is the only tier-restricted feature on the
  // platform. Only gate left here: must be logged in at all.
  const canUseAiAssistant = isAuthenticated;

  const handleAiCtaClick = () => {
    if (canUseAiAssistant) return;
    openAuthModal({ mode: 'register', initialRole: 'Client' });
  };

  const pickCms = (cms: ToolCatalogEntry | undefined, field: 'title' | 'description' | 'badge', fallback: string) =>
    overrideText(fallback, (cms?.[`${field}${catLang === 'ka' ? 'Ka' : 'En'}` as keyof ToolCatalogEntry] as string | undefined) ?? undefined);
  const aiCta = (label: string, href: string) => (canUseAiAssistant ? { label, href } : { label, onClick: handleAiCtaClick });

  const allCards: CatalogCardData[] = ([
    {
      key: 'enterprise-ai',
      icon: Bot,
      accent: 'indigo',
      title: ov(t.aiTitle, enterpriseAiCms, 'title'),
      badge: ov(t.aiAvailable, enterpriseAiCms, 'badge'),
      description: ov(t.aiDesc, enterpriseAiCms, 'description'),
      features: withFeatures([
        { icon: MessageSquareText, label: t.aiBullet1 },
        { icon: BookOpen, label: t.aiBullet2 },
        { icon: Code2, label: t.aiBullet3 },
        { icon: BarChart3, label: t.aiBullet4 },
      ], enterpriseAiCms, catLang),
      imageUrl: enterpriseAiCms?.imageUrl,
      videoUrl: enterpriseAiCms?.videoUrl,
      cta: aiCta(t.aiCta, '/dashboard/tools/chatbot-builder'),
      onLearnMore: () => setOverviewModal('enterpriseAi'),
    },
    // One card for the proctored exam. There used to be two (the employer
    // "screening" card and a "practice exam" card) that both opened the same
    // /dashboard/tools/proctored-exam page; the practice tool was retired
    // (see proctored-exam.tsx). Its CMS cover is still used as a fallback.
    {
      key: 'exam',
      icon: ShieldCheck,
      accent: 'cyan',
      title: ov(t.examTitle, examScreeningCms, 'title'),
      badge: ov(t.aiAvailable, examScreeningCms, 'badge'),
      description: ov(t.examDesc, examScreeningCms, 'description'),
      features: withFeatures([
        { icon: Sparkles, label: t.examBullet1 },
        { icon: ShieldAlert, label: t.examBullet2 },
        { icon: BarChart3, label: t.examBullet3 },
        { icon: Code2, label: t.examBullet4 },
      ], examScreeningCms, catLang),
      imageUrl: examScreeningCms?.imageUrl || proctoringCms?.imageUrl,
      videoUrl: examScreeningCms?.videoUrl || proctoringCms?.videoUrl,
      cta: aiCta(t.examCta, '/dashboard/tools/proctored-exam'),
      onLearnMore: () => setOverviewModal('examProctoring'),
    },
    {
      key: 'childrens-book',
      icon: BookOpen,
      accent: 'pink',
      title: pickCms(childrensBookCms, 'title', tCB('pageTitle')),
      badge: pickCms(childrensBookCms, 'badge', tCB('cardBadge')),
      comingSoon: childrensBookCms?.status === 'COMING_SOON',
      description: pickCms(childrensBookCms, 'description', tCB('pageSubtitle')),
      tag: tCB('catalogTag'),
      features: withFeatures([], childrensBookCms, catLang),
      imageUrl: childrensBookCms?.imageUrl,
      videoUrl: childrensBookCms?.videoUrl,
      cta: childrensBookCms?.status === 'COMING_SOON' ? undefined : { label: tCB('catalogCta'), href: '/dashboard/tools/childrens-book' },
    },
    {
      key: 'english-tutor',
      icon: GraduationCap,
      accent: 'purple',
      title: pickCms(englishTutorCms, 'title', t.tutorTitle),
      badge: pickCms(englishTutorCms, 'badge', t.tutorBadge),
      comingSoon: englishTutorCms?.status === 'COMING_SOON',
      description: pickCms(englishTutorCms, 'description', t.tutorDesc),
      features: withFeatures([], englishTutorCms, catLang),
      imageUrl: englishTutorCms?.imageUrl,
      videoUrl: englishTutorCms?.videoUrl,
      cta: englishTutorCms?.status === 'COMING_SOON' ? undefined : { label: t.tutorCta, href: '/dashboard/english-tutor' },
    },
    {
      key: 'educator-hub',
      icon: Sparkles,
      accent: 'amber',
      title: pickCms(educatorHubCms, 'title', tEdu('pageTitle')),
      badge: pickCms(educatorHubCms, 'badge', tEdu('vipBadge')),
      description: pickCms(educatorHubCms, 'description', tEdu('pageSubtitle')),
      features: withFeatures([], educatorHubCms, catLang),
      imageUrl: educatorHubCms?.imageUrl,
      videoUrl: educatorHubCms?.videoUrl,
      cta: { label: tEdu('trialCta'), href: '/dashboard/tools/educator-hub' },
    },
    {
      key: 'media-studio',
      icon: Mic,
      accent: 'pink',
      title: pickCms(mediaStudioCms, 'title', tm('catalogTitle')),
      badge: pickCms(mediaStudioCms, 'badge', t.aiAvailable),
      description: pickCms(mediaStudioCms, 'description', tm('catalogDesc')),
      tag: tm('catalogTag'),
      features: withFeatures([], mediaStudioCms, catLang),
      imageUrl: mediaStudioCms?.imageUrl,
      videoUrl: mediaStudioCms?.videoUrl,
      cta: { label: tm('catalogCta'), href: '/dashboard/tools/media-studio' },
    },
    {
      key: 'screener',
      icon: Users,
      accent: 'emerald',
      title: t.screenerTitle,
      comingSoon: true,
      description: t.screenerDesc,
      features: [],
    },
    {
      key: 'cyber-sentinel',
      icon: ShieldAlert,
      accent: 'cyan',
      title: ov(t.sentinelTitle, sentinelCms, 'title'),
      comingSoon: true,
      description: ov(t.sentinelDesc, sentinelCms, 'description'),
      features: withFeatures([
        { icon: Download, label: t.sentinelBullet1 },
        { icon: ShieldAlert, label: t.sentinelBullet2 },
        { icon: BarChart3, label: t.sentinelBullet3 },
        { icon: EyeOff, label: t.sentinelBullet4 },
      ], sentinelCms, catLang),
      imageUrl: sentinelCms?.imageUrl,
      videoUrl: sentinelCms?.videoUrl,
      cta: { label: t.sentinelCta, onClick: () => setShowWaitlistModal(true) },
    },
    {
      key: 'ag-saia',
      icon: KeyRound,
      accent: 'indigo',
      title: ov(t.agsaiaTitle, agsaiaCms, 'title'),
      comingSoon: true,
      description: ov(t.agsaiaDesc, agsaiaCms, 'description'),
      features: withFeatures([
        { icon: KeyRound, label: t.agsaiaBullet1 },
        { icon: ShieldAlert, label: t.agsaiaBullet2 },
        { icon: EyeOff, label: t.agsaiaBullet3 },
        { icon: BarChart3, label: t.agsaiaBullet4 },
      ], agsaiaCms, catLang),
      imageUrl: agsaiaCms?.imageUrl,
      videoUrl: agsaiaCms?.videoUrl,
      cta: { label: t.agsaiaContact, href: 'mailto:contact@cdc.org.ge', external: false },
      onLearnMore: () => setOverviewModal('agsaia'),
    },
    ...customToolEntries(toolCatalog?.tools).map((entry, i) => customEntryCard(entry, catLang, i)),
  ] as CatalogCardData[]).filter((card) => {
    // Hidden when an admin sets the tool-catalog entry to DISABLED (same
    // rule as marketplace/index.tsx's SaaS cards).
    const cms = card.key === 'childrens-book' ? childrensBookCms : card.key === 'english-tutor' ? englishTutorCms : undefined;
    return cms?.status !== 'DISABLED';
  });
  const availableCards = allCards.filter((c) => !c.comingSoon);
  const comingSoonCards = allCards.filter((c) => c.comingSoon);

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
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

        <div className="mb-10 md:mb-12 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            CDC AI
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{t.title}</h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t.subtitle}</p>
          <a
            href="https://www.cdc.org.ge/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            {t.poweredBy}
          </a>
        </div>

        {/* Available tools: one uniform card per product (same size, same
            button style). A tool's own color appears only on its icon tile. */}
        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
          {t.availableHeading}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mb-12">
          {availableCards.map((card) => (
            <CatalogCard key={card.key} card={card} learnMoreLabel={t.learnMore} comingSoonLabel={t.comingSoon} />
          ))}
        </div>

        {comingSoonCards.length > 0 && (
          <>
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
              {t.comingSoonHeading}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mb-12">
              {comingSoonCards.map((card) => (
                <CatalogCard key={card.key} card={card} learnMoreLabel={t.learnMore} comingSoonLabel={t.comingSoon} />
              ))}
            </div>
          </>
        )}

        {/* Store — downloadable products (UI kits, prompts, templates), a
            separate concept from CDC's own SaaS products above. */}
        <Link
          href="/marketplace"
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-underline text-current hover:border-purple-400 transition-colors"
        >
          <div>
            <h3 className="text-base font-black tracking-wide mb-1">{t.storeCta}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.storeCtaDesc}</p>
          </div>
          <span className={toolSecondaryButton}>{t.storeCtaButton} →</span>
        </Link>
      </div>

      <SiteFooter />

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
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['mediaStudio', 'educatorHub', 'childrensBook'])) },
});
