import { Code2, UploadCloud, BarChart3, ShieldCheck, ShieldAlert, EyeOff, KeyRound } from 'lucide-react';

// Shared "Learn More" content for ProductOverviewCard — used by both
// pages/tools.tsx (marketing) and BusinessAiTab.tsx (Dashboard > My Tools),
// so the two surfaces never drift into describing the same product
// differently.
export const PRODUCT_OVERVIEW = {
  ka: {
    enterpriseAi: {
      whatYouGet:
        'თქვენი ბიზნესისთვის საკუთარი, ავტონომიური AI თანამშრომელი — სწავლობს თქვენს კომპანიაზე ატვირთული დოკუმენტებიდან და პასუხობს საიტის ვიზიტორებს 24/7 რეჟიმში.',
      whyGameChanger: [
        '24/7 ლიდების შენარჩუნება — არც ერთი ვიზიტორის შეკითხვა არ რჩება უპასუხოდ',
        'საბაზისო მხარდაჭერის (support) დატვირთვის შემცირება',
        'მყისიერი პასუხები აჩქარებს გაყიდვების ციკლს',
      ],
      keyBenefits: [
        { icon: Code2, label: '1-სტრიქონიანი HTML ინტეგრაცია' },
        { icon: UploadCloud, label: 'შეუზღუდავი დოკუმენტების ატვირთვა' },
        { icon: BarChart3, label: 'რეალურ დროში ანალიტიკა' },
        { icon: ShieldCheck, label: 'უსაფრთხო, დომენებზე შეზღუდული წვდომა' },
      ],
      pricing: {
        trialLabel: '10-დღიანი უფასო საცდელი პერიოდი (0 ₾ ვერიფიკაციის დაჭერა ბარათზე)',
        baseFeeLabel: '99 ₾/თვე საბაზისო საფასური — პლატფორმა, დაშბორდი, უსაფრთხოება და მხარდაჭერა',
        usageLabel: '+ გადაიხადეთ მხოლოდ რეალურად მოხმარებული ტოკენების მიხედვით',
      },
      integrationSteps: ['მონაცემების ატვირთვა', '1-სტრიქონიანი კოდის კოპირება', 'საიტზე ჩასმა'],
    },
    agsaia: {
      whatYouGet:
        'სუვერენული, ავტონომიური AI უსაფრთხოების კვანძი თქვენი ინფრასტრუქტურისთვის — შექმნილია მომავალი თაობის მუქარების პრევენციულად აღმოსაჩენად.',
      whyGameChanger: [
        'ნულოვანი ნდობის (Zero-Trust) არქიტექტურა კრიპტოგრაფიული ვერიფიკაციით',
        'პროაქტიული მოტყუების ტექნოლოგია რეალური შეტევების გამოსავლენად',
        'სრულად სუვერენული — თქვენი მონაცემები არასდროს ტოვებს თქვენს კონტროლს',
      ],
      keyBenefits: [
        { icon: KeyRound, label: 'Zero-Knowledge Proof ავთენტიფიკაცია' },
        { icon: ShieldAlert, label: 'რეალურ დროში მუქარის დეტექცია' },
        { icon: EyeOff, label: 'თაფლის ქოთნის (Honeypot) მუქარის მოზიდვა' },
        { icon: BarChart3, label: 'ყოველდღიური უსაფრთხოების ანგარიში' },
      ],
      pricing: {
        trialLabel: '10-დღიანი უფასო საცდელი — გაშვებისთანავე',
        baseFeeLabel: '99 ₾/თვე საბაზისო საფასური (დაგეგმილი)',
        usageLabel: '+ გამოყენებაზე დაფუძნებული ტარიფი (Pay-As-You-Go)',
      },
    },
  },
  en: {
    enterpriseAi: {
      whatYouGet:
        "Your own autonomous AI employee for your business — it learns from documents you upload and answers your website's visitors 24/7.",
      whyGameChanger: [
        "24/7 lead retention — no visitor's question ever goes unanswered",
        'Reduced baseline support workload',
        'Instant replies speed up the sales cycle',
      ],
      keyBenefits: [
        { icon: Code2, label: '1-Line HTML Integration' },
        { icon: UploadCloud, label: 'Unlimited document uploads' },
        { icon: BarChart3, label: 'Real-time analytics' },
        { icon: ShieldCheck, label: 'Secure, domain-restricted access' },
      ],
      pricing: {
        trialLabel: '10-Day Free Trial (0 GEL card verification hold)',
        baseFeeLabel: '99 GEL/month Base Fee — platform, dashboard, security & support',
        usageLabel: '+ Pay strictly for the tokens you actually consume',
      },
      integrationSteps: ['Upload Data', 'Copy 1-Line Script', 'Paste on Website'],
    },
    agsaia: {
      whatYouGet:
        'A sovereign, autonomous AI security node for your infrastructure — built to preventively detect next-generation threats.',
      whyGameChanger: [
        'Zero-Trust architecture with cryptographic verification',
        'Proactive deception technology to surface real attacks',
        'Fully sovereign — your data never leaves your control',
      ],
      keyBenefits: [
        { icon: KeyRound, label: 'Zero-Knowledge Proof authentication' },
        { icon: ShieldAlert, label: 'Real-time threat detection' },
        { icon: EyeOff, label: 'Honeypot-based threat luring' },
        { icon: BarChart3, label: 'Daily security report' },
      ],
      pricing: {
        trialLabel: '10-Day Free Trial — available at launch',
        baseFeeLabel: '99 GEL/month Base Fee (planned)',
        usageLabel: '+ Pay-As-You-Go usage-based pricing',
      },
    },
  },
} as const;
