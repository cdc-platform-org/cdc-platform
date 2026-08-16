// Content for /privacy, /terms, /refund-policy — kept as data (not inline
// JSX) for the same reason as aboutContent.ts: easy to update without
// touching page/layout code. See merchantInfo.ts for the entity block these
// pages also display.
//
// NOTE: this is starter/template legal copy reflecting how the platform
// actually works (BOG as payment processor, the 60-day account-deletion
// grace period, the unified 20% marketplace commission, etc.) — it has not
// been reviewed by a lawyer. Have Georgian legal counsel review before
// relying on it for real compliance, especially the specific refund
// timeframes below.

import { LegalSection } from '@/src/components/layout/LegalSections';
import { merchantInfo } from './merchantInfo';

const entityLineKa = `${merchantInfo.orgNameKa} (ს/კ ${merchantInfo.identificationCode})`;
const entityLineEn = `${merchantInfo.orgNameEn} (ID Code ${merchantInfo.identificationCode})`;

export const lastUpdated = '2026-08-16';

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
        'CDC Platform აერთიანებს: ონლაინ სასწავლო კურსებს (ვიდეო გაკვეთილები, სერტიფიცირება), ფრილანს/სამუშაო ბირჟას (გარიგებები, ესქროუ ანგარიშსწორება), მენტორობის სესიებს, ციფრულ მაღაზიას, ვაკანსიების დაფას და კომუნიკაციის ფორუმს.',
        'CDC ცენტრი მოქმედებს როგორც შუამავალი პლატფორმა და, ფრილანს გარიგებებში, ესქროუ აგენტი — უზრუნველყოფს მომხმარებლებს შორის ტრანზაქციების უსაფრთხო ჩატარებას, მაგრამ არ წარმოადგენს მხარეს კონკრეტულ მომსახურების ხელშეკრულებაში დამკვეთსა და შემსრულებელს/მენტორს შორის.',
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
        'გარიგებაზე დაფინანსებული თანხა ინახება ესქროუში, სანამ დამკვეთი არ დაადასტურებს შესრულებულ სამუშაოს. პლატფორმის ჯამური მომსახურების საკომისიო შეადგენს გარიგების ღირებულების 20%-ს — ორი კომპონენტისგან შემდგარი: 10% საბანკო საგადახდო სისტემის ტრანზაქციის საკომისიო და 10% CDC ცენტრის პლატფორმული მხარდაჭერის საკომისიო, იგივე სტრუქტურა, რაც ციფრულ მაღაზიაშია აღწერილი (იხ. მე-6 პუნქტი).',
        'ფრილანსერი იღებს სუფთა შემოსავლის 80%-ს. ესქროუს გამოთავისუფლების პირობები (დამკვეთის დადასტურება ან დავის გადაწყვეტის პროცედურა) აღწერილია გარიგების პროცესში.',
      ],
    },
    {
      heading: '6. ციფრული მაღაზია — შემოსავლის განაწილება',
      paragraphs: [
        'ციფრული მაღაზიის (Digital Store) მეშვეობით პროდუქტის გაყიდვისას პლატფორმის ჯამური მომსახურების საკომისიო შეადგენს 20%-ს. აღნიშნული მოიცავს ორ კომპონენტს: 10% — საბანკო საგადახდო სისტემის (საქართველოს ბანკი) ტრანზაქციის საკომისიო და 10% — CDC ცენტრის პლატფორმული მხარდაჭერის საკომისიო.',
        'ავტორი (Creator) იღებს სუფთა შემოსავლის 80%-ს, რომელიც გადახდის წარმატებით დასრულებისთანავე ავტომატურად ისახება მისი შიდა პროფილის ბალანსზე (Earnings Balance). შიდა ბალანსიდან თანხის პირად საბანკო ანგარიშზე გადარიცხვა (განაღდება) ხორციელდება განაღდების მოთხოვნის დაფიქსირებიდან 1 სამუშაო დღის ვადაში.',
      ],
    },
    {
      heading: '7. მენტორობის სესიები — გაუქმება და არდასწრება',
      paragraphs: [
        'სესიის უფასო გაუქმება შესაძლებელია დაგეგმილ დროამდე მინიმუმ 12 საათით ადრე — ამ შემთხვევაში თანხა ბრუნდება სრულად, საბანკო ტრანზაქციის საკომისიოს გამოკლებით (იხ. მე-10 პუნქტი).',
        'თუ სესია გაუქმდება დაგეგმილ დროამდე 12 საათზე ნაკლებ დროში, გადახდილი თანხის 50% რჩება პლატფორმასთან, როგორც მენტორის დაჯავშნილი დროის კომპენსაცია; დარჩენილი 50% უბრუნდება სტუდენტს.',
        'თუ მენტორი არ გამოცხადდება დაგეგმილ სესიაზე (No-Show) და სესია არ ჩატარდება, სტუდენტს უბრუნდება გადახდილი თანხის 100%.',
      ],
    },
    {
      heading: '8. მომხმარებლის ქცევა',
      paragraphs: [
        'აკრძალულია: სხვისი ანგარიშის გამოყენება, პლატფორმის გვერდის ავლით პირდაპირი კონტაქტის დამყარება გადახდის თავიდან ასაცილებლად, თაღლითობა, საავტორო უფლებების დარღვევა.',
      ],
    },
    {
      heading: '9. ინტელექტუალური საკუთრება',
      paragraphs: [
        'კურსის მასალები, ვიდეოები და სერტიფიკატის შაბლონები წარმოადგენს CDC-ის საკუთრებას. სერტიფიკატის მფლობელს აქვს უფლება გამოიყენოს იგი პირადი პორტფოლიოსთვის.',
      ],
    },
    {
      heading: '10. გადახდები, საბანკო საკომისიო და ინვოისები',
      paragraphs: [
        'გადახდები მუშავდება საქართველოს ბანკის (BOG) მეშვეობით, ლარში (₾). ფასები მითითებულია პლატფორმაზე შესყიდვის მომენტში.',
        'მომხმარებლის ნებაყოფლობითი მოთხოვნით განხორციელებული თანხის დაბრუნების შემთხვევაში (მათ შორის კურსის ან მენტორობის სესიის დაბრუნება), დაბრუნებული თანხიდან დაიქვითება საბანკო ტრანზაქციის საკომისიო (დაახლოებით 1.5%–2%), რომელიც უკვე დაერიცხა თანხის თავდაპირველი დამუშავებისას. CDC ცენტრი არ არის პასუხისმგებელი მომხმარებლის მიერ დაშვებული შეცდომით გამოწვეულ დამატებით საბანკო ხარჯებზე.',
        'ყოველ დასრულებულ შესყიდვაზე, ესქროუს ტრანზაქციაზე და მენტორობის ჯავშანზე ავტომატურად გენერირდება ოფიციალური PDF ინვოისი — შესყიდვისას/პროფილში მითითებული მყიდველის მონაცემების (სახელი/კომპანია, ელფოსტა, საიდენტიფიკაციო/საგადასახადო კოდი) საფუძველზე, ბუღალტრული აღრიცხვის მიზნებისთვის.',
      ],
    },
    {
      heading: '11. ესქროუს დავების გადაწყვეტა და არბიტრაჟი',
      paragraphs: [
        'ესქროუში დაფინანსებულ გარიგებებთან დაკავშირებული დავის შემთხვევაში (მაგ. შესრულებული სამუშაოს ხარისხთან ან მოცულობასთან დაკავშირებით), მხარეები წარადგენენ შესაბამის მტკიცებულებებს პლატფორმის დავების გადაწყვეტის პროცედურის ფარგლებში.',
        'CDC ცენტრი იტოვებს საბოლოო გადაწყვეტილების მიღების უფლებას წარმოდგენილი მტკიცებულებების საფუძველზე და განსაზღვრავს ესქროუში დაბლოკილი თანხის განაწილებას მხარეებს შორის. ეს გადაწყვეტილება არ ზღუდავს მხარეთა უფლებას, დავა განიხილონ სასამართლოში საქართველოს კანონმდებლობის შესაბამისად.',
      ],
    },
    {
      heading: '12. პასუხისმგებლობის შეზღუდვა',
      paragraphs: [
        'პლატფორმა მოწოდებულია „როგორც არის" პრინციპით. CDC არ არის პასუხისმგებელი მომხმარებლებს შორის დადებული გარიგებების შედეგებზე ფრილანს ბირჟაზე, გარდა კანონმდებლობით გათვალისწინებული შემთხვევებისა.',
      ],
    },
    {
      heading: '13. მარეგულირებელი კანონმდებლობა',
      paragraphs: [
        'წინამდებარე პირობები რეგულირდება საქართველოს კანონმდებლობით. დავები განიხილება საქართველოს კომპეტენტურ სასამართლოებში.',
      ],
    },
    {
      heading: '14. კონტაქტი',
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
        'The CDC Platform combines: online courses (video lessons, certification), a freelance/work marketplace (deals, escrow settlement), mentorship sessions, a Digital Store, a job board, and a community forum.',
        'CDC Center acts as an intermediary platform and, in freelance deals, an escrow agent — it facilitates secure transactions between users, but is not a party to the specific service agreement between a client and a freelancer/mentor.',
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
        'Funds for a gig are held in escrow until the client approves the delivered work. The total platform service fee is 20% of the deal value, made up of two components: a 10% bank payment-system transaction fee and a 10% CDC Center platform support fee — the same structure described for the Digital Store (see Section 6).',
        'The freelancer receives a net 80% share. Escrow release conditions (client approval, or the dispute-resolution process) are described during the deal process.',
      ],
    },
    {
      heading: '6. Digital Store — Revenue Split',
      paragraphs: [
        'When a product is sold through the Digital Store, the total platform service fee is 20% of the sale price. This is made up of two components: a 10% bank payment-system transaction fee (Bank of Georgia) and a 10% CDC Center platform support fee.',
        'The creator receives a net 80% share, which is automatically credited to their internal profile balance (Earnings Balance) immediately upon successful payment completion. Withdrawing funds from that internal balance to a personal bank account is processed within 1 business day of the withdrawal request being submitted.',
      ],
    },
    {
      heading: '7. Mentorship Sessions — Cancellation & No-Show Policy',
      paragraphs: [
        "Free cancellation is available up to 12 hours before the scheduled session — in this case the full amount is refunded, minus the bank transaction fee (see Section 10).",
        "If a session is cancelled less than 12 hours before the scheduled time, 50% of the amount paid is retained by the platform as compensation for the mentor's reserved time; the remaining 50% is refunded to the student.",
        'If the mentor fails to attend the scheduled session (No-Show) and the session does not take place, the student receives a 100% refund of the amount paid.',
      ],
    },
    {
      heading: '8. User Conduct',
      paragraphs: [
        'Prohibited: using another\'s account, circumventing the platform to make direct contact in order to avoid payment, fraud, and copyright infringement.',
      ],
    },
    {
      heading: '9. Intellectual Property',
      paragraphs: [
        'Course materials, videos, and certificate templates are the property of CDC. Certificate holders may use their certificate for personal portfolio purposes.',
      ],
    },
    {
      heading: '10. Payments, Bank Fees, and Invoices',
      paragraphs: [
        'Payments are processed via Bank of Georgia (BOG), in Georgian Lari (₾). Prices are as displayed on the platform at the time of purchase.',
        "For refunds issued at the user's voluntary request (including course or mentorship-session refunds), the bank transaction fee already incurred when processing the original payment (approximately 1.5%–2%) is deducted from the refunded amount. CDC Center is not liable for additional banking costs caused by user error.",
        'An official PDF invoice is automatically generated for every completed purchase, escrow transaction, and mentorship booking, using the buyer details (name/company, email, identification/tax code) provided at checkout or in the profile, for accounting purposes.',
      ],
    },
    {
      heading: '11. Escrow Dispute Resolution and Arbitration',
      paragraphs: [
        "In the event of a dispute relating to an escrow-funded deal (e.g. regarding the quality or scope of delivered work), both parties submit relevant evidence as part of the platform's dispute-resolution process.",
        "CDC Center reserves the right to make a final determination based on the evidence submitted and to decide how the funds held in escrow are allocated between the parties. This determination does not limit either party's right to pursue the dispute in court under Georgian law.",
      ],
    },
    {
      heading: '12. Limitation of Liability',
      paragraphs: [
        'The platform is provided "as is". CDC is not liable for the outcomes of deals made between users on the freelance marketplace, except as required by law.',
      ],
    },
    {
      heading: '13. Governing Law',
      paragraphs: [
        'These terms are governed by the laws of Georgia. Disputes are subject to the competent courts of Georgia.',
      ],
    },
    {
      heading: '14. Contact',
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
        'თანხის სრული დაბრუნება შესაძლებელია შესყიდვიდან 24 საათის განმავლობაში, თუ მომხმარებელს ნანახი აქვს კურსის კონტენტის 10%-ზე ნაკლები და არ არის გაცემული სერტიფიკატი.',
        '24 საათის შემდეგ, ან თუ კონტენტის 10% ან მეტი უკვე ნანახია, თანხა არ ბრუნდება — ვინაიდან სერვისი უკვე მიწოდებულია მომხმარებლის თანხმობით.',
      ],
    },
    {
      heading: '3. ციფრული მაღაზია — არადაბრუნებადი პროდუქტები',
      paragraphs: [
        'ციფრული მაღაზიის (Digital Store) პროდუქტები (შაბლონები, დიზაინის ფაილები, ციფრული ინსტრუმენტები და სხვ.) წარმოადგენს დაუყოვნებლივ მიწოდებად ციფრულ საქონელს. პროდუქტის გადმოწერის შემდეგ თანხა არ ბრუნდება არცერთ შემთხვევაში — შესყიდვის მომენტში მომხმარებელი ეთანხმება დაუყოვნებელ მიწოდებას და გამოხატავს უარს გაუქმების სტანდარტულ უფლებაზე.',
      ],
    },
    {
      heading: '4. ტექნიკური ხარვეზი',
      paragraphs: [
        'თუ კურსზე წვდომა ვერ ხერხდება ჩვენი ტექნიკური ხარვეზის გამო და პრობლემა არ მოგვარდება გონივრულ ვადაში, თანხა ბრუნდება სრულად, ზემოთ მოცემული ვადის მიუხედავად.',
      ],
    },
    {
      heading: '5. ფრილანს ბირჟის გარიგებები',
      paragraphs: [
        'ესქროუში დაფინანსებული გარიგებები რეგულირდება ცალკე — თანხა თავისუფლდება მხოლოდ დამკვეთის მიერ სამუშაოს დადასტურების შემდეგ, ან დავის შემთხვევაში, პლატფორმის დავების გადაწყვეტის პროცედურით (იხ. წესები და პირობები, მე-11 პუნქტი).',
      ],
    },
    {
      heading: '6. მენტორობის სესიები — გაუქმება და არდასწრება',
      paragraphs: [
        'სესიის უფასო გაუქმება შესაძლებელია დაგეგმილ დროამდე მინიმუმ 12 საათით ადრე — თანხა ბრუნდება სრულად, საბანკო ტრანზაქციის საკომისიოს გამოკლებით (იხ. მე-7 პუნქტი).',
        'დაგეგმილ დროამდე 12 საათზე ნაკლებ დროში გაუქმებისას, გადახდილი თანხის 50% რჩება პლატფორმასთან მენტორის დაჯავშნილი დროის კომპენსაციად; დარჩენილი 50% უბრუნდება სტუდენტს.',
        'თუ მენტორი არ გამოცხადდება დაგეგმილ სესიაზე (No-Show), სტუდენტს უბრუნდება გადახდილი თანხის 100%.',
      ],
    },
    {
      heading: '7. საბანკო ტრანზაქციის საკომისიო',
      paragraphs: [
        'მომხმარებლის ნებაყოფლობითი მოთხოვნით განხორციელებულ ნებისმიერ დაბრუნებას (კურსი ან მენტორობის სესია) გამოაკლდება საბანკო ტრანზაქციის საკომისიო (დაახლოებით 1.5%–2%), რომელიც უკვე დაერიცხა თანხის თავდაპირველი დამუშავებისას. CDC ცენტრი არ არის პასუხისმგებელი მომხმარებლის მიერ დაშვებული შეცდომით გამოწვეულ დამატებით საბანკო ხარჯებზე.',
      ],
    },
    {
      heading: '8. დაბრუნების მოთხოვნის პროცედურა',
      paragraphs: [
        `დაბრუნების მოსათხოვად მოგვწერეთ: ${merchantInfo.email}, მიუთითეთ შესყიდვის თარიღი და კურსის/სესიის დასახელება. მოთხოვნას განვიხილავთ 5 სამუშაო დღის განმავლობაში, დამტკიცების შემთხვევაში თანხა ბრუნდება იმავე გადახდის მეთოდზე (საქართველოს ბანკის მეშვეობით) 14 კალენდარულ დღემდე.`,
      ],
    },
    {
      heading: '9. კონტაქტი',
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
        'A full refund is available within 24 hours of purchase, provided the user has watched less than 10% of the course content and no certificate has been issued.',
        "After 24 hours, or if 10% or more of the content has already been watched, the purchase is non-refundable — since the service has already been delivered with the user's consent.",
      ],
    },
    {
      heading: '3. Digital Store — Non-Refundable Products',
      paragraphs: [
        'Digital Store products (templates, design files, digital tools, etc.) are instantly-delivered digital goods. Once a product has been downloaded, it is non-refundable under any circumstances — at the time of purchase the user agrees to immediate delivery and waives the standard right of withdrawal.',
      ],
    },
    {
      heading: '4. Technical Failure',
      paragraphs: [
        'If course access fails due to a technical fault on our side and the issue is not resolved within a reasonable time, a full refund is issued regardless of the timeframe above.',
      ],
    },
    {
      heading: '5. Freelance Marketplace Deals',
      paragraphs: [
        "Escrow-funded deals are governed separately — funds are released only after the client approves the delivered work, or, in case of a dispute, via the platform's dispute-resolution process (see Terms & Conditions, Section 11).",
      ],
    },
    {
      heading: '6. Mentorship Sessions — Cancellation & No-Show',
      paragraphs: [
        'Free cancellation is available up to 12 hours before the scheduled session — the full amount is refunded, minus the bank transaction fee (see Section 7).',
        "If cancelled less than 12 hours before the scheduled time, 50% of the amount paid is retained by the platform as compensation for the mentor's reserved time; the remaining 50% is refunded to the student.",
        'If the mentor fails to attend the scheduled session (No-Show), the student receives a 100% refund of the amount paid.',
      ],
    },
    {
      heading: '7. Bank Transaction Fees',
      paragraphs: [
        "Any refund issued at the user's voluntary request (course or mentorship session) has the bank transaction fee already incurred when processing the original payment (approximately 1.5%–2%) deducted from it. CDC Center is not liable for additional banking costs caused by user error.",
      ],
    },
    {
      heading: '8. How to Request a Refund',
      paragraphs: [
        `To request a refund, email us at ${merchantInfo.email} with your purchase date and course/session name. Requests are reviewed within 5 business days; if approved, funds are returned to the original payment method (via Bank of Georgia) within up to 14 calendar days.`,
      ],
    },
    {
      heading: '9. Contact',
      paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
};
