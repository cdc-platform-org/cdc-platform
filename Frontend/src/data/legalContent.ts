// Content for /privacy, /terms, /refund-policy — kept as data (not inline
// JSX) for the same reason as aboutContent.ts: easy to update without
// touching page/layout code. See merchantInfo.ts for the entity block these
// pages also display.
//
// NOTE: this is starter/template legal copy reflecting how the platform
// actually works (BOG as payment processor, the 60-day account-deletion
// grace period, the 10% marketplace commission, etc.) — it has not been
// reviewed by a lawyer. Have Georgian legal counsel review before relying on
// it for real compliance, especially the specific refund timeframes below.

import { LegalSection } from '@/src/components/layout/LegalSections';
import { merchantInfo } from './merchantInfo';

const entityLineKa = `${merchantInfo.orgNameKa} (ს/კ ${merchantInfo.identificationCode})`;
const entityLineEn = `${merchantInfo.orgNameEn} (ID Code ${merchantInfo.identificationCode})`;

export const lastUpdated = '2026-07-22';

export const privacyPolicy: { ka: LegalSection[]; en: LegalSection[] } = {
  ka: [
    {
      heading: '1. შესავალი',
      paragraphs: [
        `წინამდებარე კონფიდენციალურობის პოლიტიკა განსაზღვრავს, თუ როგორ აგროვებს, იყენებს და იცავს ${entityLineKa} („CDC", „ჩვენ") პერსონალურ მონაცემებს პლატფორმის (cdc.org.ge) მომხმარებელთა შესახებ, საქართველოს კანონმდებლობის შესაბამისად.`,
      ],
    },
    {
      heading: '2. რა მონაცემებს ვაგროვებთ',
      paragraphs: [
        'ანგარიშის მონაცემები: სახელი, ელ-ფოსტა, ტელეფონის ნომერი, პაროლი (დაშიფრული).',
        'სასწავლო მონაცემები: კურსზე ჩარიცხვა, გაკვეთილების პროგრესი, სერტიფიკატები.',
        'გადახდის მონაცემები: ტრანზაქციის ისტორია — ბარათის დეტალებს ჩვენ არ ვინახავთ, გადახდებს ამუშავებს საქართველოს ბანკი (BOG).',
        'კომუნიკაციის მონაცემები: ფორუმის პოსტები, პირადი შეტყობინებები, მხარდაჭერის მიმოწერა.',
        'ტექნიკური მონაცემები: IP მისამართი, ბრაუზერის ტიპი, საიტზე აქტივობის ჟურნალი.',
      ],
    },
    {
      heading: '3. მონაცემთა გამოყენების მიზნები',
      paragraphs: [
        'პლატფორმის სერვისების მიწოდება — კურსებზე წვდომა, სერტიფიცირება, ფრილანს ბირჟა და ვაკანსიების დაფა.',
        'გადახდების დამუშავება და ანგარიშსწორება.',
        'ანგარიშთან დაკავშირებული შეტყობინებების გაგზავნა (ელ-ფოსტის დადასტურება, გადახდის სტატუსი).',
        'პლატფორმის უსაფრთხოებისა და ხარისხის გაუმჯობესება.',
      ],
    },
    {
      heading: '4. მონაცემთა გაზიარება მესამე მხარეებთან',
      paragraphs: [
        'ჩვენ ვიყენებთ სანდო მომსახურების პროვაიდერებს, რომლებიც მუშავებენ მონაცემებს ჩვენი დავალებით: საქართველოს ბანკი (გადახდების დამუშავება), Bunny.net (ვიდეო კონტენტის მიწოდება), Microsoft Azure (ფაილების უსაფრთხო შენახვა). მონაცემები არ იყიდება და არ გადაეცემა მესამე მხარეებს სარეკლამო მიზნებისთვის.',
      ],
    },
    {
      heading: '5. მონაცემთა შენახვის ვადა',
      paragraphs: [
        'ანგარიშის წაშლის მოთხოვნის შემთხვევაში, ანგარიში დაუყოვნებლივ დეაქტივირდება. 60 დღის განმავლობაში მონაცემები ინახება (ანგარიშის აღდგენის შესაძლებლობით), რის შემდეგაც ან საბოლოოდ იშლება, ან ანონიმიზდება, თუ მასზე დაკავშირებულია სხვა მომხმარებლის ფინანსური/საქმიანი ჩანაწერები.',
      ],
    },
    {
      heading: '6. თქვენი უფლებები',
      paragraphs: [
        'თქვენ გაქვთ უფლება მოითხოვოთ თქვენს შესახებ არსებული მონაცემების ასლი, მათი შესწორება, წაშლა ან დამუშავების შეზღუდვა. მოთხოვნისთვის დაგვიკავშირდით: ' + merchantInfo.email + '.',
      ],
    },
    {
      heading: '7. კონტაქტი',
      paragraphs: [
        `${entityLineKa}`,
        `მისამართი: ${merchantInfo.addressKa}`,
        `ელ-ფოსტა: ${merchantInfo.email} · ტელეფონი: ${merchantInfo.phone}`,
      ],
    },
  ],
  en: [
    {
      heading: '1. Introduction',
      paragraphs: [
        `This Privacy Policy explains how ${entityLineEn} ("CDC", "we") collects, uses, and protects the personal data of users of the platform (cdc.org.ge), in accordance with Georgian law.`,
      ],
    },
    {
      heading: '2. What Data We Collect',
      paragraphs: [
        'Account data: name, email, phone number, password (encrypted).',
        'Learning data: course enrollments, lesson progress, certificates.',
        'Payment data: transaction history — we do not store card details; payments are processed by Bank of Georgia (BOG).',
        'Communication data: forum posts, private messages, support correspondence.',
        'Technical data: IP address, browser type, site activity logs.',
      ],
    },
    {
      heading: '3. Purposes of Use',
      paragraphs: [
        'Providing platform services — course access, certification, the freelance marketplace, and job board.',
        'Processing payments and settlements.',
        'Sending account-related notifications (email verification, payment status).',
        'Improving platform security and quality.',
      ],
    },
    {
      heading: '4. Sharing With Third Parties',
      paragraphs: [
        'We use trusted service providers who process data on our behalf: Bank of Georgia (payment processing), Bunny.net (video content delivery), Microsoft Azure (secure file storage). Data is never sold or shared with third parties for advertising purposes.',
      ],
    },
    {
      heading: '5. Data Retention',
      paragraphs: [
        'When you request account deletion, your account is deactivated immediately. Data is retained for 60 days (during which the account can be restored), after which it is either permanently deleted or anonymized if linked to another user\'s financial/business records.',
      ],
    },
    {
      heading: '6. Your Rights',
      paragraphs: [
        `You have the right to request a copy of your data, its correction, deletion, or a restriction on its processing. To make a request, contact us at ${merchantInfo.email}.`,
      ],
    },
    {
      heading: '7. Contact',
      paragraphs: [
        `${entityLineEn}`,
        `Address: ${merchantInfo.addressEn}`,
        `Email: ${merchantInfo.email} · Phone: ${merchantInfo.phone}`,
      ],
    },
  ],
};

export const termsAndConditions: { ka: LegalSection[]; en: LegalSection[] } = {
  ka: [
    {
      heading: '1. პირობების მიღება',
      paragraphs: [
        `პლატფორმის (cdc.org.ge) გამოყენებით თქვენ ეთანხმებით წინამდებარე წესებსა და პირობებს. პლატფორმის ოპერატორია ${entityLineKa}.`,
      ],
    },
    {
      heading: '2. სერვისის აღწერა',
      paragraphs: [
        'CDC Platform აერთიანებს: ონლაინ სასწავლო კურსებს (ვიდეო გაკვეთილები, სერტიფიცირება), ფრილანს/სამუშაო ბირჟას (გარიგებები, ესქროუ ანგარიშსწორება), ვაკანსიების დაფას და კომუნიკაციის ფორუმს.',
      ],
    },
    {
      heading: '3. ანგარიშის რეგისტრაცია',
      paragraphs: [
        'სერვისების გამოსაყენებლად საჭიროა ანგარიშის შექმნა და ელ-ფოსტის დადასტურება. თქვენ პასუხისმგებელი ხართ თქვენი ანგარიშის მონაცემების უსაფრთხოებაზე.',
      ],
    },
    {
      heading: '4. კურსზე ჩარიცხვა და წვდომა',
      paragraphs: [
        'გადახდის წარმატებით დასრულების შემდეგ, კურსზე წვდომა გენერირდება დაუყოვნებლივ (ავტომატურად). კურსის კონტენტი განკუთვნილია პირადი, არაკომერციული გამოყენებისთვის.',
      ],
    },
    {
      heading: '5. ფრილანს ბირჟა და ესქროუ',
      paragraphs: [
        'გარიგებაზე დაფინანსებული თანხა ინახება ესქროუში, სანამ დამკვეთი არ დაადასტურებს შესრულებულ სამუშაოს. პლატფორმის საკომისიო შეადგენს გარიგების ღირებულების 10%-ს. ესქროუს გამოთავისუფლების პირობები აღწერილია გარიგების პროცესში.',
      ],
    },
    {
      heading: '6. მომხმარებლის ქცევა',
      paragraphs: [
        'აკრძალულია: სხვისი ანგარიშის გამოყენება, პლატფორმის გვერდის ავლით პირდაპირი კონტაქტის დამყარება გადახდის თავიდან ასაცილებლად, თაღლითობა, საავტორო უფლებების დარღვევა.',
      ],
    },
    {
      heading: '7. ინტელექტუალური საკუთრება',
      paragraphs: [
        'კურსის მასალები, ვიდეოები და სერტიფიკატის შაბლონები წარმოადგენს CDC-ის საკუთრებას. სერტიფიკატის მფლობელს აქვს უფლება გამოიყენოს იგი პირადი პორტფოლიოსთვის.',
      ],
    },
    {
      heading: '8. გადახდები',
      paragraphs: [
        'გადახდები მუშავდება საქართველოს ბანკის (BOG) მეშვეობით, ლარში (₾). ფასები მითითებულია პლატფორმაზე შესყიდვის მომენტში.',
      ],
    },
    {
      heading: '9. პასუხისმგებლობის შეზღუდვა',
      paragraphs: [
        'პლატფორმა მოწოდებულია „როგორც არის" პრინციპით. CDC არ არის პასუხისმგებელი მომხმარებლებს შორის დადებული გარიგებების შედეგებზე ფრილანს ბირჟაზე, გარდა კანონმდებლობით გათვალისწინებული შემთხვევებისა.',
      ],
    },
    {
      heading: '10. მარეგულირებელი კანონმდებლობა',
      paragraphs: [
        'წინამდებარე პირობები რეგულირდება საქართველოს კანონმდებლობით. დავები განიხილება საქართველოს კომპეტენტურ სასამართლოებში.',
      ],
    },
    {
      heading: '11. კონტაქტი',
      paragraphs: [`${entityLineKa} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
  en: [
    {
      heading: '1. Acceptance of Terms',
      paragraphs: [
        `By using the platform (cdc.org.ge), you agree to these Terms & Conditions. The platform is operated by ${entityLineEn}.`,
      ],
    },
    {
      heading: '2. Description of Service',
      paragraphs: [
        'The CDC Platform combines: online courses (video lessons, certification), a freelance/work marketplace (deals, escrow settlement), a job board, and a community forum.',
      ],
    },
    {
      heading: '3. Account Registration',
      paragraphs: [
        'Using the services requires creating an account and verifying your email. You are responsible for the security of your account credentials.',
      ],
    },
    {
      heading: '4. Course Enrollment and Access',
      paragraphs: [
        'Upon successful payment, course access is generated instantly (automatically). Course content is for personal, non-commercial use only.',
      ],
    },
    {
      heading: '5. Freelance Marketplace and Escrow',
      paragraphs: [
        'Funds for a gig are held in escrow until the client approves the delivered work. The platform commission is 10% of the deal value. Escrow release conditions are described during the deal process.',
      ],
    },
    {
      heading: '6. User Conduct',
      paragraphs: [
        'Prohibited: using another\'s account, circumventing the platform to make direct contact in order to avoid payment, fraud, and copyright infringement.',
      ],
    },
    {
      heading: '7. Intellectual Property',
      paragraphs: [
        'Course materials, videos, and certificate templates are the property of CDC. Certificate holders may use their certificate for personal portfolio purposes.',
      ],
    },
    {
      heading: '8. Payments',
      paragraphs: [
        'Payments are processed via Bank of Georgia (BOG), in Georgian Lari (₾). Prices are as displayed on the platform at the time of purchase.',
      ],
    },
    {
      heading: '9. Limitation of Liability',
      paragraphs: [
        'The platform is provided "as is". CDC is not liable for the outcomes of deals made between users on the freelance marketplace, except as required by law.',
      ],
    },
    {
      heading: '10. Governing Law',
      paragraphs: [
        'These terms are governed by the laws of Georgia. Disputes are subject to the competent courts of Georgia.',
      ],
    },
    {
      heading: '11. Contact',
      paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
};

export const refundPolicy: { ka: LegalSection[]; en: LegalSection[] } = {
  ka: [
    {
      heading: '1. ზოგადი პრინციპი — ციფრული პროდუქტი',
      paragraphs: [
        'CDC-ის კურსები არის ციფრული, არამატერიალური პროდუქტი, რომლის მიწოდება (კურსზე წვდომა) ხდება დაუყოვნებლივ გადახდის დადასტურების შემდეგ. საქართველოს კანონმდებლობის შესაბამისად, მომხმარებელი წინასწარ ეთანხმება, რომ დაუყოვნებელი წვდომის მიღების შემდეგ შესაძლოა შეიზღუდოს გაუქმების სტანდარტული უფლება, ქვემოთ მოცემული პირობების ფარგლებში.',
      ],
    },
    {
      heading: '2. კურსის შესყიდვის თანხის დაბრუნება',
      paragraphs: [
        'თანხის სრული დაბრუნება შესაძლებელია შესყიდვიდან 3 კალენდარული დღის განმავლობაში, თუ მომხმარებელს გავლილი აქვს არაუმეტეს 2 გაკვეთილისა (ან კურსის კონტენტის 20%-ზე ნაკლები) და არ არის გაცემული სერტიფიკატი.',
        '3 დღის შემდეგ, ან თუ კონტენტის მნიშვნელოვანი ნაწილი უკვე გახსნილია/ნანახია, თანხა არ ბრუნდება — ვინაიდან სერვისი უკვე მიწოდებულია მომხმარებლის თანხმობით.',
      ],
    },
    {
      heading: '3. ტექნიკური ხარვეზი',
      paragraphs: [
        'თუ კურსზე წვდომა ვერ ხერხდება ჩვენი ტექნიკური ხარვეზის გამო და პრობლემა არ მოგვარდება გონივრულ ვადაში, თანხა ბრუნდება სრულად, ზემოთ მოცემული ვადის მიუხედავად.',
      ],
    },
    {
      heading: '4. ფრილანს ბირჟის გარიგებები',
      paragraphs: [
        'ესქროუში დაფინანსებული გარიგებები რეგულირდება ცალკე — თანხა თავისუფლდება მხოლოდ დამკვეთის მიერ სამუშაოს დადასტურების შემდეგ, ან დავის შემთხვევაში, პლატფორმის დავების გადაწყვეტის პროცედურით.',
      ],
    },
    {
      heading: '5. დაბრუნების მოთხოვნის პროცედურა',
      paragraphs: [
        `დაბრუნების მოსათხოვად მოგვწერეთ: ${merchantInfo.email}, მიუთითეთ შესყიდვის თარიღი და კურსის დასახელება. მოთხოვნას განვიხილავთ 5 სამუშაო დღის განმავლობაში, დამტკიცების შემთხვევაში თანხა ბრუნდება იმავე გადახდის მეთოდზე (საქართველოს ბანკის მეშვეობით) 14 კალენდარულ დღემდე.`,
      ],
    },
    {
      heading: '6. კონტაქტი',
      paragraphs: [`${entityLineKa} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
  en: [
    {
      heading: '1. General Principle — Digital Product',
      paragraphs: [
        'CDC courses are a digital, non-tangible product, delivered (course access granted) immediately upon payment confirmation. In accordance with Georgian law, the user acknowledges in advance that once instant access has been granted, the standard right of withdrawal may be limited, within the terms set out below.',
      ],
    },
    {
      heading: '2. Course Purchase Refunds',
      paragraphs: [
        'A full refund is available within 3 calendar days of purchase, provided the user has completed no more than 2 lessons (or less than 20% of the course content) and no certificate has been issued.',
        'After 3 days, or if a significant portion of the content has already been accessed/viewed, the purchase is non-refundable — since the service has already been delivered with the user\'s consent.',
      ],
    },
    {
      heading: '3. Technical Failure',
      paragraphs: [
        'If course access fails due to a technical fault on our side and the issue is not resolved within a reasonable time, a full refund is issued regardless of the timeframe above.',
      ],
    },
    {
      heading: '4. Freelance Marketplace Deals',
      paragraphs: [
        'Escrow-funded deals are governed separately — funds are released only after the client approves the delivered work, or, in case of a dispute, via the platform\'s dispute-resolution process.',
      ],
    },
    {
      heading: '5. How to Request a Refund',
      paragraphs: [
        `To request a refund, email us at ${merchantInfo.email} with your purchase date and course name. Requests are reviewed within 5 business days; if approved, funds are returned to the original payment method (via Bank of Georgia) within up to 14 calendar days.`,
      ],
    },
    {
      heading: '6. Contact',
      paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
};
