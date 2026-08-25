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

// Terms & Conditions specifically is translated into all 9 site locales
// (unlike privacyPolicy/refundPolicy below, which stay ka/en only for now)
// — see terms.tsx, which reads router.locale directly instead of going
// through SimpleSiteLayout's binary GEO/ENG toggle the other legal pages
// still use.
export type FullLocale = 'ka' | 'en' | 'de' | 'es' | 'fr' | 'uk' | 'tr' | 'hy' | 'az';

export const termsAndConditions: Record<FullLocale, LegalSection[]> = {
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
      heading: '5. მომხმარებლის ვერიფიკაცია და ბეჯები',
      paragraphs: [
        'პლატფორმა სთავაზობს მომხმარებლებს სამ დამოუკიდებელ, ერთმანეთისგან განსხვავებულ ვერიფიკაციის სტატუსს — მომხმარებელს შეუძლია ერთდროულად ფლობდეს ერთი, ორი, ან სამივე ბეჯი, შესაბამისი კრიტერიუმის დაკმაყოფილების შემთხვევაში:',
        '🎓 „ვერიფიცირებული სტუდენტი" — ენიჭება CDC-ის ოფიციალური კურსის წარმატებით დასრულების საფუძველზე (ავტომატურად, სასერტიფიკატო გამოცდის ჩაბარების შემდეგ) ან ადმინისტრაციის მიერ დადასტურებული კურსდამთავრებულობის საფუძველზე.',
        '⚡ „ვერიფიცირებული ფრილანსერი" — ენიჭება პირადობის დამადასტურებელი დოკუმენტის (პირადობის მოწმობა/პასპორტი) ატვირთვისა და ადმინისტრაციის მიერ დამტკიცების შემდეგ, ასევე ეყრდნობა ფრილანსერის მიერ AI-ზედამხედველობის ქვეშ ჩაბარებულ, კონკრეტულ უნარზე ორიენტირებულ საკვალიფიკაციო გამოცდებს (Skill Verification Exams).',
        '🏢 „ვერიფიცირებული ბიზნესი" — ენიჭება კომპანიის სარეგისტრაციო დოკუმენტის (ამონაწერი მეწარმეთა და არასამეწარმეო (არაკომერციული) იურიდიული პირების რეესტრიდან, ან უცხოური ეკვივალენტი) წარმოდგენისა და ადმინისტრაციის მიერ დამტკიცების საფუძველზე.',
        'ვერიფიკაციის სტატუსს პირდაპირი გავლენა აქვს გადახდილ საკომისიოზე — იხ. მე-6 პუნქტი, „დაუდასტურებელი სტატუსის დამატებითი საკომისიო (+5%)".',
      ],
    },
    {
      heading: '6. დაუდასტურებელი სტატუსის დამატებითი საკომისიო (+5%)',
      paragraphs: [
        'ვერიფიცირებული ანგარიშისთვის (იხ. მე-5 პუნქტი — შესაბამისი ტრეკის მიხედვით ვერიფიცირებული ფრილანსერი ან ბიზნესი) მოქმედებს პლატფორმის საბაზისო საკომისიო განაკვეთი (20%, იხ. მე-7 და მე-8 პუნქტები).',
        'დაუდასტურებელ (Standard/Unverified) ანგარიშს ერიცხება დამატებითი +5% საკომისიო საბაზისო განაკვეთზე — ანუ ჯამური საკომისიო შეადგენს 25%-ს, როგორც ციფრულ მაღაზიაში, ისე ფრილანს ბირჟის ესქროუ ტრანზაქციებში.',
        'საკომისიოს განაკვეთი განისაზღვრება ავტომატურად, გარიგების/გაყიდვის დაფიქსირების მომენტში, გამყიდველის/შემსრულებლის იმჟამინდელი ვერიფიკაციის სტატუსის მიხედვით, და ფიქსირდება ტრანზაქციაზე — შემდგომში სტატუსის შეცვლა უკვე დაფიქსირებულ განაკვეთს არ ცვლის. ვერიფიკაციის მიღება (დამტკიცების შემდეგ) მომდევნო ტრანზაქციებზე დაუყოვნებლივ აქტიურდება.',
      ],
    },
    {
      heading: '7. ფრილანს ბირჟა და ესქროუ',
      paragraphs: [
        'გარიგებაზე დაფინანსებული თანხა ინახება ესქროუში, სანამ დამკვეთი არ დაადასტურებს შესრულებულ სამუშაოს, ან, ეტაპობრივი (მილსტოუნებად დაყოფილი) გარიგების შემთხვევაში, სანამ არ დაადასტურდება კონკრეტული ეტაპი. პლატფორმის ჯამური მომსახურების საკომისიო შეადგენს გარიგების ღირებულების 20%-ს ვერიფიცირებული ფრილანსერისთვის ან 25%-ს დაუდასტურებელი ანგარიშისთვის (იხ. მე-6 პუნქტი) — ორი კომპონენტისგან შემდგარი: 10% საბანკო საგადახდო სისტემის ტრანზაქციის საკომისიო და 10% (ან, +5% წესის შემთხვევაში, 15%) CDC ცენტრის პლატფორმული მხარდაჭერის საკომისიო.',
        'ფრილანსერი იღებს სუფთა შემოსავალს (გარიგების ღირებულება მინუს ზემოთ მითითებული საკომისიო). ესქროუს გამოთავისუფლების პირობებია: (ა) დამკვეთის მიერ შესრულებული სამუშაოს პირდაპირი დადასტურება; (ბ) დამკვეთის მხრიდან პასუხის არარსებობა შეთანხმებული ვადის ამოწურვის შემდეგ (ავტომატური დადასტურება); ან (გ) დავის გადაწყვეტის პროცედურის შედეგად მიღებული ადმინისტრაციული გადაწყვეტილება (იხ. მე-14 პუნქტი).',
        'გადახდის მომსახურების პროვაიდერი (საქართველოს ბანკი) მოქმედებს ევროპის გადახდის სერვისების დირექტივის მე-2 რედაქციის (PSD2) სტანდარტების შესაბამისად, რაც გულისხმობს მომხმარებლის ძლიერი ავთენტიფიკაციის (Strong Customer Authentication, SCA) გამოყენებას — მათ შორის, საჭიროებისამებრ, დამატებით ორფაქტორიან ან ორეტაპიან ავთენტიფიკაციას (Step-Up Re-Authentication) — არაჩვეულებრივი, საეჭვო ან მაღალრისკიანი აქტივობის (მაგ. უჩვეულო IP მისამართიდან შესვლა, არასტანდარტული მოწყობილობა, არაჩვეულებრივი ოდენობის განაღდების მოთხოვნა) გამოვლენის შემთხვევაში, გადახდის/განაღდების ავტორიზაციამდე.',
      ],
    },
    {
      heading: '8. ციფრული მაღაზია — შემოსავლის განაწილება',
      paragraphs: [
        'ციფრული მაღაზიის (Digital Store) მეშვეობით პროდუქტის გაყიდვისას პლატფორმის ჯამური მომსახურების საკომისიო შეადგენს 20%-ს ვერიფიცირებული ავტორისთვის ან 25%-ს დაუდასტურებელი ანგარიშისთვის (იხ. მე-6 პუნქტი). აღნიშნული მოიცავს ორ კომპონენტს: 10% — საბანკო საგადახდო სისტემის (საქართველოს ბანკი) ტრანზაქციის საკომისიო და 10% (ან, +5% წესის შემთხვევაში, 15%) — CDC ცენტრის პლატფორმული მხარდაჭერის საკომისიო.',
        'ავტორი (Creator) იღებს სუფთა შემოსავალს, რომელიც გადახდის წარმატებით დასრულებისთანავე ავტომატურად ისახება მისი შიდა პროფილის ბალანსზე (Earnings Balance). შიდა ბალანსიდან თანხის პირად საბანკო ანგარიშზე გადარიცხვა (განაღდება) ხორციელდება განაღდების მოთხოვნის დაფიქსირებიდან 1 სამუშაო დღის ვადაში.',
      ],
    },
    {
      heading: '9. ციფრული მაღაზია — ინტელექტუალური საკუთრება: გაყიდვა vs. ლიცენზირება',
      paragraphs: [
        'ციფრული მაღაზიის პროდუქტზე (შაბლონი, დიზაინის ფაილი, UI ნაკრები, AI სატესტო/სარეკლამო მასალა, ან სხვა ციფრული აქტივი) საავტორო უფლება რჩება პროდუქტის ავტორთან (Creator) — შესყიდვა არ წარმოადგენს საავტორო უფლების გადაცემას (ownership transfer), არამედ მოიცავს პროდუქტის გამოყენების ლიცენზიის მინიჭებას, ავტორის მიერ განსაზღვრული ლიცენზიის ტიპის შესაბამისად (მაგალითად, პირადი გამოყენებისთვის ან კომერციული პროექტისთვის).',
        'მყიდველს არ აქვს უფლება: პროდუქტი ხელახლა გაყიდოს, გაავრცელოს დამოუკიდებელ პროდუქტად, ან წარმოადგინოს საკუთარ ნამუშევრად (თუ ლიცენზია პირდაპირ არ ითვალისწინებს ამგვარ უფლებას). თითოეული პროდუქტის გვერდზე მითითებულია მისი კონკრეტული ლიცენზიის ტიპი და ფარგლები შესყიდვამდე.',
        'CDC-ის საკუთარი, უშუალოდ პლატფორმის მიერ შექმნილი/კურირებული პროდუქტების შემთხვევაში (რომლებსაც არა აქვთ ცალკე მითითებული გარე ავტორი), მოქმედებს ცალკე, ამ პროდუქტისთვის მითითებული ლიცენზია.',
      ],
    },
    {
      heading: '10. მენტორობის სესიები — გაუქმება და არდასწრება',
      paragraphs: [
        'სესიის უფასო გაუქმება შესაძლებელია დაგეგმილ დროამდე მინიმუმ 12 საათით ადრე — ამ შემთხვევაში თანხა ბრუნდება სრულად, საბანკო ტრანზაქციის საკომისიოს გამოკლებით (იხ. მე-13 პუნქტი).',
        'თუ სესია გაუქმდება დაგეგმილ დროამდე 12 საათზე ნაკლებ დროში, გადახდილი თანხის 50% რჩება პლატფორმასთან, როგორც მენტორის დაჯავშნილი დროის კომპენსაცია; დარჩენილი 50% უბრუნდება სტუდენტს.',
        'თუ მენტორი არ გამოცხადდება დაგეგმილ სესიაზე (No-Show) და სესია არ ჩატარდება, სტუდენტს უბრუნდება გადახდილი თანხის 100%.',
        'დამატებით, კურსის შესყიდვის თანხის სრული დაბრუნება შესაძლებელია შესყიდვიდან 24 საათის განმავლობაში კონკრეტული პირობებით — იხ. ცალკე გამოქვეყნებული „დაბრუნების პოლიტიკა" (/refund-policy) დეტალური წესებისთვის.',
      ],
    },
    {
      heading: '11. მომხმარებლის ქცევა',
      paragraphs: [
        'აკრძალულია: სხვისი ანგარიშის გამოყენება, პლატფორმის გვერდის ავლით პირდაპირი კონტაქტის დამყარება გადახდის თავიდან ასაცილებლად, თაღლითობა, საავტორო უფლებების დარღვევა.',
      ],
    },
    {
      heading: '12. პლატფორმისა და კურსის ინტელექტუალური საკუთრება',
      paragraphs: [
        'CDC-ის მიერ უშუალოდ შექმნილი კურსის მასალები, ვიდეოები და სერტიფიკატის შაბლონები წარმოადგენს CDC-ის საკუთრებას. სერტიფიკატის მფლობელს აქვს უფლება გამოიყენოს იგი პირადი პორტფოლიოსთვის. (ციფრული მაღაზიის მესამე მხარის პროდუქტების ინტელექტუალური საკუთრების ცალკე რეჟიმისთვის იხ. მე-9 პუნქტი.)',
      ],
    },
    {
      heading: '13. გადახდები, საბანკო საკომისიო და ინვოისები',
      paragraphs: [
        'გადახდები მუშავდება საქართველოს ბანკის (BOG) მეშვეობით, ლარში (₾). ფასები მითითებულია პლატფორმაზე შესყიდვის მომენტში.',
        'მომხმარებლის ნებაყოფლობითი მოთხოვნით განხორციელებული თანხის დაბრუნების შემთხვევაში (მათ შორის კურსის ან მენტორობის სესიის დაბრუნება), დაბრუნებული თანხიდან დაიქვითება საბანკო ტრანზაქციის საკომისიო (დაახლოებით 1.5%–2%), რომელიც უკვე დაერიცხა თანხის თავდაპირველი დამუშავებისას. CDC ცენტრი არ არის პასუხისმგებელი მომხმარებლის მიერ დაშვებული შეცდომით გამოწვეულ დამატებით საბანკო ხარჯებზე.',
        'ყოველ დასრულებულ შესყიდვაზე, ესქროუს ტრანზაქციაზე და მენტორობის ჯავშანზე ავტომატურად გენერირდება ოფიციალური PDF ინვოისი — შესყიდვისას/პროფილში მითითებული მყიდველის მონაცემების (სახელი/კომპანია, ელფოსტა, საიდენტიფიკაციო/საგადასახადო კოდი) საფუძველზე, ბუღალტრული აღრიცხვის მიზნებისთვის.',
      ],
    },
    {
      heading: '14. ესქროუს დავების გადაწყვეტა, PSD2/SCA შესაბამისობა და არბიტრაჟი',
      paragraphs: [
        'ესქროუში დაფინანსებულ გარიგებებთან დაკავშირებული დავის შემთხვევაში (მაგ. შესრულებული სამუშაოს ხარისხთან ან მოცულობასთან დაკავშირებით), მხარეები წარადგენენ შესაბამის მტკიცებულებებს პლატფორმის დავების გადაწყვეტის პროცედურის ფარგლებში.',
        'CDC ცენტრი იტოვებს საბოლოო გადაწყვეტილების მიღების უფლებას წარმოდგენილი მტკიცებულებების საფუძველზე და განსაზღვრავს ესქროუში დაბლოკილი თანხის განაწილებას მხარეებს შორის. ეს გადაწყვეტილება არ ზღუდავს მხარეთა უფლებას, დავა განიხილონ სასამართლოში საქართველოს კანონმდებლობის შესაბამისად.',
        'თანხის განაღდების მოთხოვნები ექვემდებარება პლატფორმის შიდა რისკის შეფასების პროცედურას (მათ შორის, საჭიროებისამებრ, PSD2/SCA-შესაბამის დამატებით ავთენტიფიკაციას, იხ. მე-7 პუნქტი) — მაღალი რისკის მქონე მოთხოვნები გადაეცემა ადმინისტრაციის ხელით განხილვას ავტომატური დამტკიცების ნაცვლად, თანხის უსაფრთხო გატანის უზრუნველსაყოფად.',
      ],
    },
    {
      heading: '15. პასუხისმგებლობის შეზღუდვა',
      paragraphs: [
        'პლატფორმა მოწოდებულია „როგორც არის" პრინციპით. CDC არ არის პასუხისმგებელი მომხმარებლებს შორის დადებული გარიგებების შედეგებზე ფრილანს ბირჟაზე, გარდა კანონმდებლობით გათვალისწინებული შემთხვევებისა.',
      ],
    },
    {
      heading: '16. მარეგულირებელი კანონმდებლობა',
      paragraphs: [
        'წინამდებარე პირობები რეგულირდება საქართველოს კანონმდებლობით. დავები განიხილება საქართველოს კომპეტენტურ სასამართლოებში.',
      ],
    },
    {
      heading: '17. კონტაქტი',
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
      heading: '5. User Verification and Badges',
      paragraphs: [
        'The platform offers three independent verification tiers. A user may hold one, two, or all three badges simultaneously, provided the corresponding criteria are met:',
        '🎓 "Verified Student" — granted upon successfully completing an official CDC course (automatically, after passing the certification exam) or on admin-confirmed graduate status.',
        '⚡ "Verified Freelancer" — granted after a government-ID/passport document is uploaded and approved by an administrator, and also relies on AI-proctored, skill-specific Skill Verification Exams a freelancer completes.',
        '🏢 "Verified Business" — granted after a company registration document (a Public Registry extract, or a foreign equivalent) is submitted and approved by an administrator.',
        'Verification status directly affects the commission charged — see Section 6, "Unverified Tier Surcharge (+5%)".',
      ],
    },
    {
      heading: '6. Unverified Tier Surcharge (+5%)',
      paragraphs: [
        'A verified account (see Section 5 — verified as a Freelancer or a Business via the relevant track) is charged the platform\'s base commission rate (20%, see Sections 7 and 8).',
        'An unverified (Standard) account is charged an additional +5% surcharge on top of the base rate — that is, a total commission of 25%, both in the Digital Store and in freelance-marketplace escrow transactions.',
        'The commission rate is determined automatically, at the moment the deal/sale is recorded, based on the seller\'s/freelancer\'s verification status at that time, and is locked onto the transaction — a later change in status does not retroactively alter an already-recorded rate. Once verification is granted (after approval), it applies immediately to subsequent transactions.',
      ],
    },
    {
      heading: '7. Freelance Marketplace and Escrow',
      paragraphs: [
        'Funds for a deal are held in escrow until the client approves the delivered work, or, for a milestone-based deal, until the specific milestone is approved. The total platform service fee is 20% of the deal value for a verified freelancer, or 25% for an unverified account (see Section 6) — made up of two components: a 10% bank payment-system transaction fee, and 10% (or, under the +5% rule, 15%) CDC Center platform support fee.',
        'The freelancer receives the net amount (deal value minus the commission above). Escrow release conditions are: (a) the client\'s direct approval of the delivered work; (b) no response from the client after the agreed deadline elapses (automatic approval); or (c) an administrative determination reached through the dispute-resolution process (see Section 14).',
        'The payment service provider (Bank of Georgia) operates in accordance with the EU\'s revised Payment Services Directive (PSD2) standards, which require Strong Customer Authentication (SCA) — including, where necessary, an additional two-factor or step-up re-authentication step — when unusual, suspicious, or high-risk activity is detected (e.g. login from an unfamiliar IP address, a non-standard device, or an unusually large withdrawal request), prior to authorizing the payment/withdrawal.',
      ],
    },
    {
      heading: '8. Digital Store — Revenue Split',
      paragraphs: [
        'When a product is sold through the Digital Store, the total platform service fee is 20% of the sale price for a verified creator, or 25% for an unverified account (see Section 6). This is made up of two components: a 10% bank payment-system transaction fee (Bank of Georgia), and 10% (or, under the +5% rule, 15%) CDC Center platform support fee.',
        'The creator receives the net amount, which is automatically credited to their internal profile balance (Earnings Balance) immediately upon successful payment completion. Withdrawing funds from that internal balance to a personal bank account is processed within 1 business day of the withdrawal request being submitted.',
      ],
    },
    {
      heading: '9. Digital Store — Intellectual Property: Sold vs. Licensed Content',
      paragraphs: [
        'Copyright in a Digital Store product (a template, design file, UI kit, AI prompt/asset pack, or other digital asset) remains with its creator — a purchase does not constitute a transfer of ownership, but rather grants a license to use the product under the license type the creator has specified (for example, for personal use or for a commercial project).',
        'A buyer is not permitted to: resell the product, redistribute it as a standalone product, or present it as their own original work, unless the license explicitly grants such a right. Each product\'s page states its specific license type and scope before purchase.',
        'For products created or curated directly by CDC itself (with no separately-attributed external creator), that product\'s own specified license applies instead.',
      ],
    },
    {
      heading: '10. Mentorship Sessions — Cancellation & No-Show Policy',
      paragraphs: [
        "Free cancellation is available up to 12 hours before the scheduled session — in this case the full amount is refunded, minus the bank transaction fee (see Section 13).",
        "If a session is cancelled less than 12 hours before the scheduled time, 50% of the amount paid is retained by the platform as compensation for the mentor's reserved time; the remaining 50% is refunded to the student.",
        'If the mentor fails to attend the scheduled session (No-Show) and the session does not take place, the student receives a 100% refund of the amount paid.',
        'Separately, a course purchase is fully refundable within 24 hours of purchase under specific conditions — see the standalone Refund Policy (/refund-policy) for the detailed rules.',
      ],
    },
    {
      heading: '11. User Conduct',
      paragraphs: [
        'Prohibited: using another\'s account, circumventing the platform to make direct contact in order to avoid payment, fraud, and copyright infringement.',
      ],
    },
    {
      heading: '12. Platform & Course Intellectual Property',
      paragraphs: [
        'Course materials, videos, and certificate templates created directly by CDC are the property of CDC. Certificate holders may use their certificate for personal portfolio purposes. (For the separate intellectual-property regime governing third-party Digital Store products, see Section 9.)',
      ],
    },
    {
      heading: '13. Payments, Bank Fees, and Invoices',
      paragraphs: [
        'Payments are processed via Bank of Georgia (BOG), in Georgian Lari (₾). Prices are as displayed on the platform at the time of purchase.',
        "For refunds issued at the user's voluntary request (including course or mentorship-session refunds), the bank transaction fee already incurred when processing the original payment (approximately 1.5%–2%) is deducted from the refunded amount. CDC Center is not liable for additional banking costs caused by user error.",
        'An official PDF invoice is automatically generated for every completed purchase, escrow transaction, and mentorship booking, using the buyer details (name/company, email, identification/tax code) provided at checkout or in the profile, for accounting purposes.',
      ],
    },
    {
      heading: '14. Escrow Dispute Resolution, PSD2/SCA Compliance, and Arbitration',
      paragraphs: [
        "In the event of a dispute relating to an escrow-funded deal (e.g. regarding the quality or scope of delivered work), both parties submit relevant evidence as part of the platform's dispute-resolution process.",
        "CDC Center reserves the right to make a final determination based on the evidence submitted and to decide how the funds held in escrow are allocated between the parties. This determination does not limit either party's right to pursue the dispute in court under Georgian law.",
        "Withdrawal requests are subject to the platform's internal risk-assessment process (including, where necessary, PSD2/SCA-compliant additional authentication, see Section 7) — high-risk requests are routed to manual administrative review instead of automatic approval, to keep the payout process secure.",
      ],
    },
    {
      heading: '15. Limitation of Liability',
      paragraphs: [
        'The platform is provided "as is". CDC is not liable for the outcomes of deals made between users on the freelance marketplace, except as required by law.',
      ],
    },
    {
      heading: '16. Governing Law',
      paragraphs: [
        'These terms are governed by the laws of Georgia. Disputes are subject to the competent courts of Georgia.',
      ],
    },
    {
      heading: '17. Contact',
      paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
    },
  ],
  de: [
    {
      heading: '1. Annahme der Geschäftsbedingungen',
      paragraphs: [
        'Durch die Nutzung der Plattform (cdc.org.ge) stimmen Sie diesen Allgemeinen Geschäftsbedingungen zu. Die Plattform wird betrieben vom Digital Careers Center (CDC Georgia) (Identifikationscode 438737743).',
      ],
    },
    {
      heading: '2. Beschreibung der Dienstleistung',
      paragraphs: [
        'Die CDC-Plattform vereint: Online-Kurse (Videolektionen, Zertifizierung), einen Freelance-/Arbeitsmarktplatz (Geschäfte, Treuhandabwicklung), Mentoring-Sitzungen, einen Digital Store, eine Stellenbörse sowie ein Community-Forum.',
        'Das CDC Center fungiert als vermittelnde Plattform und, bei Freelance-Geschäften, als Treuhänder (Escrow-Agent) — es erleichtert sichere Transaktionen zwischen Nutzern, ist jedoch nicht Vertragspartei der konkreten Leistungsvereinbarung zwischen einem Auftraggeber und einem Freelancer/Mentor.',
      ],
    },
    {
      heading: '3. Kontoregistrierung',
      paragraphs: [
        'Die Nutzung der Dienste setzt die Erstellung eines Kontos sowie die Verifizierung Ihrer E-Mail-Adresse voraus. Sie sind für die Sicherheit Ihrer Kontozugangsdaten verantwortlich.',
      ],
    },
    {
      heading: '4. Kurseinschreibung und Zugang',
      paragraphs: [
        'Nach erfolgreicher Zahlung wird der Kurszugang unverzüglich (automatisch) erzeugt. Die Kursinhalte sind ausschließlich für den persönlichen, nicht-kommerziellen Gebrauch bestimmt.',
      ],
    },
    {
      heading: '5. Nutzerverifizierung und Abzeichen',
      paragraphs: [
        'Die Plattform bietet drei voneinander unabhängige Verifizierungsstufen an. Ein Nutzer kann eines, zwei oder alle drei Abzeichen gleichzeitig besitzen, sofern die jeweiligen Kriterien erfüllt sind:',
        '🎓 „Verifizierter Student" — wird nach erfolgreichem Abschluss eines offiziellen CDC-Kurses vergeben (automatisch, nach Bestehen der Zertifizierungsprüfung) oder bei administrativ bestätigtem Absolventenstatus.',
        '⚡ „Verifizierter Freelancer" — wird vergeben, nachdem ein amtliches Ausweisdokument/Reisepass hochgeladen und von einem Administrator genehmigt wurde, und beruht zudem auf KI-überwachten, fachspezifischen Skill Verification Exams, die ein Freelancer absolviert.',
        '🏢 „Verifiziertes Unternehmen" — wird vergeben, nachdem ein Unternehmensregistrierungsdokument (ein Auszug aus dem öffentlichen Register oder ein ausländisches Äquivalent) eingereicht und von einem Administrator genehmigt wurde.',
        'Der Verifizierungsstatus wirkt sich unmittelbar auf die erhobene Provision aus — siehe Abschnitt 6, „Zuschlag für nicht verifizierte Stufe (+5 %)".',
      ],
    },
    {
      heading: '6. Zuschlag für nicht verifizierte Stufe (+5 %)',
      paragraphs: [
        'Bei einem verifizierten Konto (siehe Abschnitt 5 — verifiziert als Freelancer oder als Unternehmen über den jeweiligen Verifizierungsweg) wird der Basis-Provisionssatz der Plattform (20 %, siehe Abschnitte 7 und 8) berechnet.',
        'Bei einem nicht verifizierten (Standard-)Konto wird zusätzlich zum Basissatz ein Zuschlag von +5 % erhoben — das heißt eine Gesamtprovision von 25 %, sowohl im Digital Store als auch bei Treuhandtransaktionen auf dem Freelance-Marktplatz.',
        'Der Provisionssatz wird automatisch zum Zeitpunkt der Erfassung des Geschäfts/Verkaufs anhand des zu diesem Zeitpunkt geltenden Verifizierungsstatus des Verkäufers/Freelancers festgelegt und für die betreffende Transaktion fixiert — eine spätere Änderung des Status ändert einen bereits erfassten Satz nicht rückwirkend. Sobald eine Verifizierung erteilt wurde (nach Genehmigung), gilt sie unmittelbar für nachfolgende Transaktionen.',
      ],
    },
    {
      heading: '7. Freelance-Marktplatz und Treuhandabwicklung (Escrow)',
      paragraphs: [
        'Die Mittel für ein Geschäft werden treuhänderisch verwahrt, bis der Auftraggeber die gelieferte Arbeit freigibt, oder, bei einem meilensteinbasierten Geschäft, bis der jeweilige Meilenstein freigegeben wird. Die gesamte Servicegebühr der Plattform beträgt 20 % des Geschäftswerts bei einem verifizierten Freelancer bzw. 25 % bei einem nicht verifizierten Konto (siehe Abschnitt 6) — bestehend aus zwei Komponenten: einer Transaktionsgebühr des Bankzahlungssystems in Höhe von 10 % sowie einer Support-Gebühr der CDC-Center-Plattform in Höhe von 10 % (bzw. gemäß der +5-%-Regelung 15 %).',
        'Der Freelancer erhält den Nettobetrag (Geschäftswert abzüglich der oben genannten Provision). Die Voraussetzungen für die Freigabe des Treuhandbetrags sind: (a) die unmittelbare Freigabe der gelieferten Arbeit durch den Auftraggeber; (b) das Ausbleiben einer Reaktion des Auftraggebers nach Ablauf der vereinbarten Frist (automatische Freigabe); oder (c) eine im Rahmen des Streitbeilegungsverfahrens getroffene administrative Entscheidung (siehe Abschnitt 14).',
        'Der Zahlungsdienstleister (Bank of Georgia) handelt in Übereinstimmung mit den Standards der überarbeiteten EU-Zahlungsdiensterichtlinie (PSD2), die eine starke Kundenauthentifizierung (SCA – Strong Customer Authentication) verlangt — einschließlich, sofern erforderlich, eines zusätzlichen Zwei-Faktor- oder Step-up-Re-Authentifizierungsschritts —, wenn ungewöhnliche, verdächtige oder risikobehaftete Aktivitäten festgestellt werden (z. B. Anmeldung von einer unbekannten IP-Adresse, einem untypischen Gerät oder eine ungewöhnlich hohe Auszahlungsanfrage), bevor die Zahlung/Auszahlung autorisiert wird.',
      ],
    },
    {
      heading: '8. Digital Store — Erlösaufteilung',
      paragraphs: [
        'Beim Verkauf eines Produkts über den Digital Store beträgt die gesamte Servicegebühr der Plattform 20 % des Verkaufspreises bei einem verifizierten Ersteller bzw. 25 % bei einem nicht verifizierten Konto (siehe Abschnitt 6). Diese setzt sich aus zwei Komponenten zusammen: einer Transaktionsgebühr des Bankzahlungssystems (Bank of Georgia) in Höhe von 10 % sowie einer Support-Gebühr der CDC-Center-Plattform in Höhe von 10 % (bzw. gemäß der +5-%-Regelung 15 %).',
        'Der Ersteller erhält den Nettobetrag, der unmittelbar nach erfolgreichem Zahlungsabschluss automatisch dem internen Profilguthaben (Earnings Balance) gutgeschrieben wird. Die Auszahlung von Mitteln aus diesem internen Guthaben auf ein persönliches Bankkonto erfolgt innerhalb von 1 Werktag nach Einreichung des Auszahlungsantrags.',
      ],
    },
    {
      heading: '9. Digital Store — Geistiges Eigentum: Verkaufte vs. lizenzierte Inhalte',
      paragraphs: [
        'Das Urheberrecht an einem Produkt des Digital Store (einer Vorlage, Design-Datei, einem UI-Kit, KI-Prompt-/Asset-Paket oder einem anderen digitalen Objekt) verbleibt bei dessen Ersteller — ein Kauf stellt keine Eigentumsübertragung dar, sondern gewährt eine Lizenz zur Nutzung des Produkts gemäß dem vom Ersteller angegebenen Lizenztyp (zum Beispiel für den persönlichen Gebrauch oder für ein kommerzielles Projekt).',
        'Es ist dem Käufer nicht gestattet: das Produkt weiterzuverkaufen, es als eigenständiges Produkt weiterzuverbreiten oder es als eigenes Originalwerk darzustellen, es sei denn, die Lizenz gewährt ausdrücklich ein solches Recht. Der jeweilige Lizenztyp und dessen Umfang werden vor dem Kauf auf der Produktseite angegeben.',
        'Für Produkte, die unmittelbar von CDC selbst erstellt oder kuratiert wurden (ohne gesondert ausgewiesenen externen Ersteller), gilt stattdessen die für dieses Produkt jeweils angegebene eigene Lizenz.',
      ],
    },
    {
      heading: '10. Mentoring-Sitzungen — Stornierungs- und No-Show-Richtlinie',
      paragraphs: [
        'Eine kostenlose Stornierung ist bis 12 Stunden vor der geplanten Sitzung möglich — in diesem Fall wird der volle Betrag abzüglich der Banktransaktionsgebühr erstattet (siehe Abschnitt 13).',
        'Wird eine Sitzung weniger als 12 Stunden vor dem geplanten Termin storniert, werden 50 % des gezahlten Betrags von der Plattform als Ausgleich für die reservierte Zeit des Mentors einbehalten; die verbleibenden 50 % werden dem Studenten erstattet.',
        'Erscheint der Mentor nicht zur geplanten Sitzung (No-Show) und findet die Sitzung deshalb nicht statt, erhält der Student eine Rückerstattung in Höhe von 100 % des gezahlten Betrags.',
        'Unabhängig davon ist ein Kurskauf unter bestimmten Voraussetzungen innerhalb von 24 Stunden nach dem Kauf vollständig erstattungsfähig — die detaillierten Regelungen finden Sie in der eigenständigen Rückerstattungsrichtlinie (/refund-policy).',
      ],
    },
    {
      heading: '11. Nutzerverhalten',
      paragraphs: [
        'Untersagt sind: die Nutzung des Kontos eines anderen, die Umgehung der Plattform zur direkten Kontaktaufnahme mit dem Ziel, eine Zahlung zu vermeiden, Betrug sowie Urheberrechtsverletzungen.',
      ],
    },
    {
      heading: '12. Geistiges Eigentum an Plattform und Kursen',
      paragraphs: [
        'Kursmaterialien, Videos und Zertifikatsvorlagen, die unmittelbar von CDC erstellt wurden, sind Eigentum von CDC. Inhaber eines Zertifikats dürfen dieses für Zwecke ihres persönlichen Portfolios verwenden. (Zur gesonderten Regelung des geistigen Eigentums an Produkten Dritter im Digital Store siehe Abschnitt 9.)',
      ],
    },
    {
      heading: '13. Zahlungen, Bankgebühren und Rechnungen',
      paragraphs: [
        'Zahlungen werden über die Bank of Georgia (BOG) in georgischem Lari (₾) abgewickelt. Es gelten die zum Zeitpunkt des Kaufs auf der Plattform angezeigten Preise.',
        'Bei Rückerstattungen, die auf freiwilligen Antrag des Nutzers erfolgen (einschließlich Rückerstattungen für Kurse oder Mentoring-Sitzungen), wird die bei der Abwicklung der ursprünglichen Zahlung bereits angefallene Banktransaktionsgebühr (ca. 1,5 %–2 %) vom erstatteten Betrag abgezogen. Das CDC Center haftet nicht für zusätzliche Bankkosten, die durch einen Fehler des Nutzers verursacht wurden.',
        'Für jeden abgeschlossenen Kauf, jede Treuhandtransaktion und jede Mentoring-Buchung wird automatisch eine offizielle PDF-Rechnung erstellt, unter Verwendung der beim Bezahlvorgang oder im Profil angegebenen Käuferdaten (Name/Firma, E-Mail, Identifikations-/Steuernummer), zu Buchhaltungszwecken.',
      ],
    },
    {
      heading: '14. Streitbeilegung bei Treuhandgeschäften, PSD2/SCA-Compliance und Schiedsverfahren',
      paragraphs: [
        'Kommt es zu einem Streitfall im Zusammenhang mit einem über Treuhand finanzierten Geschäft (z. B. hinsichtlich der Qualität oder des Umfangs der gelieferten Arbeit), legen beide Parteien im Rahmen des Streitbeilegungsverfahrens der Plattform die maßgeblichen Nachweise vor.',
        'Das CDC Center behält sich das Recht vor, auf Grundlage der vorgelegten Nachweise eine abschließende Entscheidung zu treffen und darüber zu bestimmen, wie die treuhänderisch verwahrten Mittel zwischen den Parteien aufgeteilt werden. Diese Entscheidung schränkt das Recht keiner der Parteien ein, den Streitfall nach georgischem Recht vor Gericht zu verfolgen.',
        'Auszahlungsanträge unterliegen dem internen Risikobewertungsverfahren der Plattform (einschließlich, sofern erforderlich, einer PSD2/SCA-konformen zusätzlichen Authentifizierung, siehe Abschnitt 7) — Anträge mit hohem Risiko werden anstelle einer automatischen Genehmigung einer manuellen administrativen Prüfung zugeführt, um den Auszahlungsprozess sicher zu halten.',
      ],
    },
    {
      heading: '15. Haftungsbeschränkung',
      paragraphs: [
        'Die Plattform wird „wie besehen" („as is") bereitgestellt. CDC haftet nicht für die Ergebnisse von Geschäften, die zwischen Nutzern auf dem Freelance-Marktplatz zustande kommen, es sei denn, das Gesetz schreibt etwas anderes vor.',
      ],
    },
    {
      heading: '16. Anwendbares Recht',
      paragraphs: [
        'Diese Bedingungen unterliegen dem Recht Georgiens. Für Streitigkeiten sind die zuständigen Gerichte Georgiens zuständig.',
      ],
    },
    {
      heading: '17. Kontakt',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Identifikationscode 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  es: [
    {
      heading: '1. Aceptación de los Términos',
      paragraphs: [
        'Al utilizar la plataforma (cdc.org.ge), usted acepta estos Términos y Condiciones. La plataforma es operada por Digital Careers Center (CDC Georgia) (Código de Identificación 438737743).',
      ],
    },
    {
      heading: '2. Descripción del Servicio',
      paragraphs: [
        'La Plataforma CDC combina: cursos en línea (videolecciones, certificación), un mercado de trabajo freelance (acuerdos, liquidación mediante depósito en garantía), sesiones de mentoría, una Digital Store, un tablón de empleos y un foro comunitario.',
        'CDC Center actúa como plataforma intermediaria y, en los acuerdos freelance, como agente de depósito en garantía — facilita transacciones seguras entre usuarios, pero no es parte del acuerdo de servicio específico entre un cliente y un freelancer/mentor.',
      ],
    },
    {
      heading: '3. Registro de Cuenta',
      paragraphs: [
        'El uso de los servicios requiere la creación de una cuenta y la verificación de su correo electrónico. Usted es responsable de la seguridad de las credenciales de su cuenta.',
      ],
    },
    {
      heading: '4. Inscripción y Acceso a los Cursos',
      paragraphs: [
        'Tras el pago exitoso, el acceso al curso se genera de forma instantánea (automática). El contenido del curso es únicamente para uso personal y no comercial.',
      ],
    },
    {
      heading: '5. Verificación de Usuarios e Insignias',
      paragraphs: [
        'La plataforma ofrece tres niveles de verificación independientes. Un usuario puede tener una, dos o las tres insignias simultáneamente, siempre que se cumplan los criterios correspondientes:',
        '🎓 «Estudiante Verificado» — se otorga al completar con éxito un curso oficial de CDC (automáticamente, tras aprobar el examen de certificación) o mediante confirmación administrativa del estatus de graduado.',
        '⚡ «Freelancer Verificado» — se otorga después de que se cargue un documento de identidad/pasaporte emitido por el gobierno y sea aprobado por un administrador, y también depende de los Skill Verification Exams específicos por habilidad, supervisados por IA, que el freelancer debe completar.',
        '🏢 «Empresa Verificada» — se otorga después de que se presente un documento de registro de la empresa (un extracto del Registro Público, o su equivalente extranjero) y sea aprobado por un administrador.',
        'El estatus de verificación afecta directamente a la comisión cobrada — véase la Sección 6, «Recargo por Nivel No Verificado (+5%)».',
      ],
    },
    {
      heading: '6. Recargo por Nivel No Verificado (+5%)',
      paragraphs: [
        'A una cuenta verificada (véase la Sección 5 — verificada como Freelancer o como Empresa a través del proceso correspondiente) se le cobra la tasa de comisión base de la plataforma (20%, véanse las Secciones 7 y 8).',
        'A una cuenta no verificada (Estándar) se le cobra un recargo adicional del +5% sobre la tasa base — es decir, una comisión total del 25%, tanto en la Digital Store como en las transacciones de depósito en garantía del mercado freelance.',
        'La tasa de comisión se determina automáticamente, en el momento en que se registra el acuerdo/venta, según el estatus de verificación del vendedor/freelancer en ese momento, y queda fijada para esa transacción — un cambio posterior en el estatus no altera de forma retroactiva una tasa ya registrada. Una vez otorgada la verificación (tras su aprobación), esta se aplica de inmediato a las transacciones posteriores.',
      ],
    },
    {
      heading: '7. Mercado Freelance y Depósito en Garantía',
      paragraphs: [
        'Los fondos de un acuerdo se retienen en depósito en garantía hasta que el cliente aprueba el trabajo entregado o, en el caso de un acuerdo basado en hitos, hasta que se aprueba el hito específico. La comisión total de servicio de la plataforma es del 20% del valor del acuerdo para un freelancer verificado, o del 25% para una cuenta no verificada (véase la Sección 6) — compuesta por dos elementos: una comisión del 10% por la transacción del sistema de pago bancario, y un 10% (o, conforme a la regla del +5%, un 15%) de comisión de soporte de la plataforma de CDC Center.',
        'El freelancer recibe el importe neto (el valor del acuerdo menos la comisión anterior). Las condiciones de liberación del depósito en garantía son: (a) la aprobación directa del cliente sobre el trabajo entregado; (b) la falta de respuesta del cliente una vez transcurrido el plazo acordado (aprobación automática); o (c) una determinación administrativa alcanzada a través del proceso de resolución de disputas (véase la Sección 14).',
        'El proveedor del servicio de pago (Bank of Georgia) opera de conformidad con los estándares de la Directiva de Servicios de Pago revisada de la UE (PSD2), que exige SCA (Autenticación Reforzada del Cliente) — incluyendo, cuando sea necesario, un paso adicional de reautenticación de dos factores o reforzada — cuando se detecta actividad inusual, sospechosa o de alto riesgo (por ejemplo, un inicio de sesión desde una dirección IP desconocida, un dispositivo no habitual, o una solicitud de retiro inusualmente elevada), antes de autorizar el pago/retiro.',
      ],
    },
    {
      heading: '8. Digital Store — Reparto de Ingresos',
      paragraphs: [
        'Cuando un producto se vende a través de la Digital Store, la comisión total de servicio de la plataforma es del 20% del precio de venta para un creador verificado, o del 25% para una cuenta no verificada (véase la Sección 6). Esta se compone de dos elementos: una comisión del 10% por la transacción del sistema de pago bancario (Bank of Georgia), y un 10% (o, conforme a la regla del +5%, un 15%) de comisión de soporte de la plataforma de CDC Center.',
        'El creador recibe el importe neto, que se acredita automáticamente en el saldo interno de su perfil (Earnings Balance) inmediatamente después de completarse con éxito el pago. El retiro de fondos de ese saldo interno hacia una cuenta bancaria personal se procesa dentro de 1 día hábil a partir de la presentación de la solicitud de retiro.',
      ],
    },
    {
      heading: '9. Digital Store — Propiedad Intelectual: Contenido Vendido frente a Contenido Licenciado',
      paragraphs: [
        'Los derechos de autor de un producto de la Digital Store (una plantilla, un archivo de diseño, un kit de interfaz de usuario, un paquete de prompts/recursos de IA, u otro activo digital) permanecen en poder de su creador — una compra no constituye una transferencia de la propiedad, sino que otorga una licencia para usar el producto conforme al tipo de licencia especificado por el creador (por ejemplo, para uso personal o para un proyecto comercial).',
        'El comprador no está autorizado a: revender el producto, redistribuirlo como un producto independiente, ni presentarlo como su propia obra original, salvo que la licencia otorgue expresamente ese derecho. En la página de cada producto se indica, antes de la compra, su tipo y alcance específicos de licencia.',
        'Para los productos creados o seleccionados directamente por el propio CDC (sin un creador externo atribuido por separado), se aplica en su lugar la licencia específica indicada para ese producto.',
      ],
    },
    {
      heading: '10. Sesiones de Mentoría — Política de Cancelación e Inasistencia',
      paragraphs: [
        'La cancelación gratuita está disponible hasta 12 horas antes de la sesión programada — en este caso se reembolsa el importe total, menos la comisión de la transacción bancaria (véase la Sección 13).',
        'Si una sesión se cancela con menos de 12 horas de antelación respecto a la hora programada, la plataforma retiene el 50% del importe pagado en concepto de compensación por el tiempo reservado del mentor; el 50% restante se reembolsa al estudiante.',
        'Si el mentor no se presenta a la sesión programada (No-Show) y la sesión no se lleva a cabo, el estudiante recibe un reembolso del 100% del importe pagado.',
        'Por separado, la compra de un curso es totalmente reembolsable dentro de las 24 horas posteriores a la compra bajo determinadas condiciones — véase la Política de Reembolsos independiente (/refund-policy) para conocer las normas detalladas.',
      ],
    },
    {
      heading: '11. Conducta del Usuario',
      paragraphs: [
        'Está prohibido: utilizar la cuenta de otra persona, eludir la plataforma para establecer contacto directo con el fin de evitar el pago, el fraude y la infracción de derechos de autor.',
      ],
    },
    {
      heading: '12. Propiedad Intelectual de la Plataforma y de los Cursos',
      paragraphs: [
        'Los materiales del curso, los videos y las plantillas de certificados creados directamente por CDC son propiedad de CDC. Los titulares de certificados pueden utilizar su certificado con fines de portafolio personal. (Para el régimen independiente de propiedad intelectual que rige los productos de terceros en la Digital Store, véase la Sección 9.)',
      ],
    },
    {
      heading: '13. Pagos, Comisiones Bancarias y Facturas',
      paragraphs: [
        'Los pagos se procesan a través de Bank of Georgia (BOG), en lari georgiano (₾). Los precios son los que se muestran en la plataforma en el momento de la compra.',
        'En el caso de los reembolsos emitidos a solicitud voluntaria del usuario (incluidos los reembolsos de cursos o de sesiones de mentoría), del importe reembolsado se deduce la comisión de la transacción bancaria ya incurrida al procesar el pago original (aproximadamente entre 1.5% y 2%). CDC Center no es responsable de los costos bancarios adicionales causados por un error del usuario.',
        'Se genera automáticamente una factura oficial en PDF para cada compra completada, cada transacción de depósito en garantía y cada reserva de mentoría, utilizando los datos del comprador (nombre/empresa, correo electrónico, código de identificación/fiscal) proporcionados en el proceso de pago o en el perfil, con fines contables.',
      ],
    },
    {
      heading: '14. Resolución de Disputas del Depósito en Garantía, Cumplimiento de PSD2/SCA y Arbitraje',
      paragraphs: [
        'En caso de disputa relacionada con un acuerdo financiado mediante depósito en garantía (por ejemplo, respecto de la calidad o el alcance del trabajo entregado), ambas partes presentan las pruebas pertinentes como parte del proceso de resolución de disputas de la plataforma.',
        'CDC Center se reserva el derecho de emitir una determinación final con base en las pruebas presentadas y de decidir cómo se distribuyen entre las partes los fondos retenidos en depósito en garantía. Esta determinación no limita el derecho de ninguna de las partes a llevar la disputa ante los tribunales conforme a la legislación de Georgia.',
        'Las solicitudes de retiro están sujetas al proceso interno de evaluación de riesgos de la plataforma (incluyendo, cuando sea necesario, autenticación adicional conforme a PSD2/SCA, véase la Sección 7) — las solicitudes de alto riesgo se derivan a revisión administrativa manual en lugar de a la aprobación automática, con el fin de mantener la seguridad del proceso de pago.',
      ],
    },
    {
      heading: '15. Limitación de Responsabilidad',
      paragraphs: [
        'La plataforma se ofrece «tal cual» («as is»). CDC no es responsable de los resultados de los acuerdos celebrados entre usuarios en el mercado freelance, salvo en los casos que exija la ley.',
      ],
    },
    {
      heading: '16. Legislación Aplicable',
      paragraphs: [
        'Estos términos se rigen por las leyes de Georgia. Las disputas están sujetas a los tribunales competentes de Georgia.',
      ],
    },
    {
      heading: '17. Contacto',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Código de Identificación 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  fr: [
    {
      heading: '1. Acceptation des Conditions',
      paragraphs: [
        'En utilisant la plateforme (cdc.org.ge), vous acceptez les présentes Conditions Générales. La plateforme est exploitée par Digital Careers Center (CDC Georgia) (Code d\'identification 438737743).',
      ],
    },
    {
      heading: '2. Description du Service',
      paragraphs: [
        'La Plateforme CDC combine : des cours en ligne (leçons vidéo, certification), une place de marché freelance/travail (transactions, règlement sous séquestre), des séances de mentorat, un Digital Store, une bourse à l\'emploi et un forum communautaire.',
        'CDC Center agit en tant que plateforme intermédiaire et, dans les transactions freelance, en tant qu\'agent séquestre — elle facilite les transactions sécurisées entre utilisateurs, mais n\'est pas partie à l\'accord de service spécifique conclu entre un client et un freelance/mentor.',
      ],
    },
    {
      heading: '3. Inscription du Compte',
      paragraphs: [
        'L\'utilisation des services nécessite la création d\'un compte et la vérification de votre adresse e-mail. Vous êtes responsable de la sécurité de vos identifiants de compte.',
      ],
    },
    {
      heading: '4. Inscription aux Cours et Accès',
      paragraphs: [
        'Dès le paiement effectué avec succès, l\'accès au cours est généré instantanément (automatiquement). Le contenu du cours est réservé à un usage personnel et non commercial.',
      ],
    },
    {
      heading: '5. Vérification des Utilisateurs et Badges',
      paragraphs: [
        'La plateforme propose trois niveaux de vérification indépendants. Un utilisateur peut détenir un, deux, ou les trois badges simultanément, à condition que les critères correspondants soient remplis :',
        '🎓 « Étudiant Vérifié » — accordé après l\'achèvement réussi d\'un cours officiel CDC (automatiquement, après réussite à l\'examen de certification) ou sur confirmation par un administrateur du statut de diplômé.',
        '⚡ « Freelance Vérifié » — accordé après le téléchargement et l\'approbation par un administrateur d\'un document d\'identité officiel/passeport, et repose également sur les Skill Verification Exams, spécifiques aux compétences et surveillés par IA, que le freelance doit compléter.',
        '🏢 « Entreprise Vérifiée » — accordé après la soumission et l\'approbation par un administrateur d\'un document d\'enregistrement de société (un extrait du Registre Public, ou un équivalent étranger).',
        'Le statut de vérification affecte directement la commission facturée — voir Section 6, « Majoration pour Niveau Non Vérifié (+5%) ».',
      ],
    },
    {
      heading: '6. Majoration pour Niveau Non Vérifié (+5%)',
      paragraphs: [
        'Un compte vérifié (voir Section 5 — vérifié en tant que Freelance ou Entreprise via le parcours correspondant) se voit facturer le taux de commission de base de la plateforme (20%, voir Sections 7 et 8).',
        'Un compte non vérifié (Standard) se voit facturer une majoration supplémentaire de +5% par rapport au taux de base — soit une commission totale de 25%, aussi bien dans le Digital Store que dans les transactions sous séquestre de la place de marché freelance.',
        'Le taux de commission est déterminé automatiquement, au moment où la transaction/vente est enregistrée, en fonction du statut de vérification du vendeur/freelance à ce moment-là, et il est fixé de manière définitive pour cette transaction — un changement ultérieur de statut ne modifie pas rétroactivement un taux déjà enregistré. Une fois la vérification accordée (après approbation), elle s\'applique immédiatement aux transactions suivantes.',
      ],
    },
    {
      heading: '7. Place de Marché Freelance et Séquestre',
      paragraphs: [
        'Les fonds relatifs à une transaction sont détenus sous séquestre jusqu\'à ce que le client approuve le travail livré, ou, pour une transaction basée sur des jalons, jusqu\'à ce que le jalon spécifique soit approuvé. Les frais de service totaux de la plateforme s\'élèvent à 20% de la valeur de la transaction pour un freelance vérifié, ou 25% pour un compte non vérifié (voir Section 6) — composés de deux éléments : des frais de transaction bancaire du système de paiement de 10%, et des frais de soutien de la plateforme CDC Center de 10% (ou, en vertu de la règle des +5%, de 15%).',
        'Le freelance reçoit le montant net (valeur de la transaction moins la commission ci-dessus). Les conditions de libération du séquestre sont : (a) l\'approbation directe du client concernant le travail livré ; (b) l\'absence de réponse du client après l\'écoulement du délai convenu (approbation automatique) ; ou (c) une décision administrative rendue dans le cadre du processus de résolution des litiges (voir Section 14).',
        'Le prestataire de services de paiement (Bank of Georgia) opère conformément aux normes de la directive européenne révisée sur les services de paiement (PSD2), qui exige une authentification forte du client (SCA) — comprenant, si nécessaire, une étape supplémentaire de ré-authentification à deux facteurs ou renforcée — lorsqu\'une activité inhabituelle, suspecte ou à haut risque est détectée (par exemple, une connexion depuis une adresse IP inconnue, un appareil non standard, ou une demande de retrait anormalement élevée), avant d\'autoriser le paiement/retrait.',
      ],
    },
    {
      heading: '8. Digital Store — Répartition des Revenus',
      paragraphs: [
        'Lorsqu\'un produit est vendu via le Digital Store, les frais de service totaux de la plateforme s\'élèvent à 20% du prix de vente pour un créateur vérifié, ou 25% pour un compte non vérifié (voir Section 6). Ceux-ci se composent de deux éléments : des frais de transaction bancaire du système de paiement de 10% (Bank of Georgia), et des frais de soutien de la plateforme CDC Center de 10% (ou, en vertu de la règle des +5%, de 15%).',
        'Le créateur reçoit le montant net, qui est automatiquement crédité sur le solde interne de son profil (Earnings Balance) immédiatement après la réussite du paiement. Le retrait des fonds de ce solde interne vers un compte bancaire personnel est traité dans un délai de 1 jour ouvrable à compter de la soumission de la demande de retrait.',
      ],
    },
    {
      heading: '9. Digital Store — Propriété Intellectuelle : Contenu Vendu vs. Sous Licence',
      paragraphs: [
        'Le droit d\'auteur sur un produit du Digital Store (un modèle, un fichier de conception, un kit d\'interface utilisateur, un pack de prompts/ressources IA, ou tout autre actif numérique) demeure la propriété de son créateur — un achat ne constitue pas un transfert de propriété, mais accorde plutôt une licence d\'utilisation du produit selon le type de licence spécifié par le créateur (par exemple, pour un usage personnel ou pour un projet commercial).',
        'Il est interdit à l\'acheteur : de revendre le produit, de le redistribuer en tant que produit autonome, ou de le présenter comme sa propre œuvre originale, sauf si la licence accorde expressément un tel droit. La page de chaque produit indique son type et son étendue de licence spécifiques avant l\'achat.',
        'Pour les produits créés ou sélectionnés directement par CDC elle-même (sans créateur externe distinctement attribué), la licence propre spécifiée pour ce produit s\'applique à la place.',
      ],
    },
    {
      heading: '10. Séances de Mentorat — Politique d\'Annulation et de Non-Présentation',
      paragraphs: [
        'L\'annulation gratuite est possible jusqu\'à 12 heures avant la séance programmée — dans ce cas, le montant total est remboursé, déduction faite des frais de transaction bancaire (voir Section 13).',
        'Si une séance est annulée moins de 12 heures avant l\'heure prévue, 50% du montant payé est retenu par la plateforme à titre de compensation pour le temps réservé du mentor ; les 50% restants sont remboursés à l\'étudiant.',
        'Si le mentor ne se présente pas à la séance programmée (No-Show) et que la séance n\'a pas lieu, l\'étudiant reçoit un remboursement de 100% du montant payé.',
        'Séparément, l\'achat d\'un cours est intégralement remboursable dans les 24 heures suivant l\'achat, sous certaines conditions spécifiques — voir la Politique de Remboursement distincte (/refund-policy) pour les règles détaillées.',
      ],
    },
    {
      heading: '11. Conduite de l\'Utilisateur',
      paragraphs: [
        'Sont interdits : l\'utilisation du compte d\'autrui, le contournement de la plateforme pour établir un contact direct afin d\'éviter le paiement, la fraude, et la violation du droit d\'auteur.',
      ],
    },
    {
      heading: '12. Propriété Intellectuelle de la Plateforme et des Cours',
      paragraphs: [
        'Les supports de cours, vidéos et modèles de certificats créés directement par CDC sont la propriété de CDC. Les titulaires de certificats peuvent utiliser leur certificat à des fins de portfolio personnel. (Pour le régime distinct de propriété intellectuelle régissant les produits tiers du Digital Store, voir Section 9.)',
      ],
    },
    {
      heading: '13. Paiements, Frais Bancaires et Factures',
      paragraphs: [
        'Les paiements sont traités via Bank of Georgia (BOG), en Lari géorgien (₾). Les prix sont ceux affichés sur la plateforme au moment de l\'achat.',
        'Pour les remboursements émis à la demande volontaire de l\'utilisateur (y compris les remboursements de cours ou de séances de mentorat), les frais de transaction bancaire déjà engagés lors du traitement du paiement initial (environ 1,5%–2%) sont déduits du montant remboursé. CDC Center n\'est pas responsable des frais bancaires supplémentaires causés par une erreur de l\'utilisateur.',
        'Une facture PDF officielle est automatiquement générée pour chaque achat, transaction sous séquestre et réservation de mentorat effectués, en utilisant les coordonnées de l\'acheteur (nom/société, e-mail, code d\'identification/fiscal) fournies lors du paiement ou dans le profil, à des fins comptables.',
      ],
    },
    {
      heading: '14. Résolution des Litiges relatifs au Séquestre, Conformité PSD2/SCA, et Arbitrage',
      paragraphs: [
        'En cas de litige relatif à une transaction financée par séquestre (par exemple, concernant la qualité ou l\'étendue du travail livré), les deux parties soumettent les preuves pertinentes dans le cadre du processus de résolution des litiges de la plateforme.',
        'CDC Center se réserve le droit de rendre une décision finale sur la base des preuves soumises et de décider de la répartition entre les parties des fonds détenus sous séquestre. Cette décision ne limite le droit d\'aucune des parties de poursuivre le litige devant les tribunaux conformément au droit géorgien.',
        'Les demandes de retrait sont soumises au processus interne d\'évaluation des risques de la plateforme (comprenant, si nécessaire, une authentification supplémentaire conforme à la PSD2/SCA, voir Section 7) — les demandes à haut risque sont orientées vers un examen administratif manuel plutôt que vers une approbation automatique, afin de garantir la sécurité du processus de versement.',
      ],
    },
    {
      heading: '15. Limitation de Responsabilité',
      paragraphs: [
        'La plateforme est fournie « en l\'état ». CDC n\'est pas responsable des résultats des transactions conclues entre utilisateurs sur la place de marché freelance, sauf disposition contraire de la loi.',
      ],
    },
    {
      heading: '16. Droit Applicable',
      paragraphs: [
        'Les présentes conditions sont régies par les lois de la Géorgie. Les litiges relèvent de la compétence des tribunaux compétents de Géorgie.',
      ],
    },
    {
      heading: '17. Contact',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Code d\'identification 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  uk: [
    {
      heading: '1. Прийняття Умов',
      paragraphs: [
        'Використовуючи платформу (cdc.org.ge), ви погоджуєтеся з цими Умовами використання. Платформу експлуатує Digital Careers Center (CDC Georgia) (Ідентифікаційний код 438737743).',
      ],
    },
    {
      heading: '2. Опис послуги',
      paragraphs: [
        'Платформа CDC поєднує: онлайн-курси (відеоуроки, сертифікація), маркетплейс фрилансу/роботи (угоди, розрахунки через ескроу), сесії наставництва, Digital Store, дошку вакансій та форум спільноти.',
        'CDC Center виступає посередницькою платформою, а в межах фриланс-угод — ескроу-агентом: він сприяє безпечним транзакціям між користувачами, але не є стороною конкретної угоди про надання послуг між замовником та фрилансером/ментором.',
      ],
    },
    {
      heading: '3. Реєстрація облікового запису',
      paragraphs: [
        'Для використання послуг необхідно створити обліковий запис і підтвердити свою електронну адресу. Ви несете відповідальність за безпеку облікових даних свого акаунта.',
      ],
    },
    {
      heading: '4. Реєстрація на курс та доступ',
      paragraphs: [
        'Після успішної оплати доступ до курсу надається миттєво (автоматично). Контент курсу призначений виключно для особистого некомерційного використання.',
      ],
    },
    {
      heading: '5. Верифікація користувачів та бейджі',
      paragraphs: [
        'Платформа пропонує три незалежні рівні верифікації. Користувач може одночасно мати один, два або всі три бейджі за умови виконання відповідних критеріїв:',
        '🎓 «Верифікований студент» — надається після успішного завершення офіційного курсу CDC (автоматично, після складання сертифікаційного іспиту) або за підтвердженим адміністратором статусом випускника.',
        '⚡ «Верифікований фрилансер» — надається після завантаження документа, що посвідчує особу (державне посвідчення особи/паспорт), та його схвалення адміністратором, а також залежить від Skill Verification Exams — іспитів з перевірки конкретних навичок під контролем ШІ (AI-proctored), які складає фрилансер.',
        '🏢 «Верифікований бізнес» — надається після подання документа про реєстрацію компанії (витягу з Публічного реєстру або іноземного еквівалента) та його схвалення адміністратором.',
        'Статус верифікації безпосередньо впливає на розмір стягуваної комісії — див. Розділ 6, «Надбавка для неверифікованого рівня (+5%)».',
      ],
    },
    {
      heading: '6. Надбавка для неверифікованого рівня (+5%)',
      paragraphs: [
        'З верифікованого облікового запису (див. Розділ 5 — верифікація як Фрилансера або Бізнесу за відповідним напрямом) стягується базова ставка комісії платформи (20%, див. Розділи 7 та 8).',
        'З неверифікованого (стандартного) облікового запису стягується додаткова надбавка +5% понад базову ставку — тобто загальна комісія становить 25%, як у Digital Store, так і в ескроу-транзакціях фриланс-маркетплейсу.',
        'Ставка комісії визначається автоматично в момент реєстрації угоди/продажу на основі статусу верифікації продавця/фрилансера на цей момент і фіксується для цієї транзакції — подальша зміна статусу не змінює заднім числом уже зафіксовану ставку. Після надання верифікації (після схвалення) вона одразу застосовується до наступних транзакцій.',
      ],
    },
    {
      heading: '7. Фриланс-маркетплейс та ескроу',
      paragraphs: [
        'Кошти за угодою утримуються на ескроу-рахунку до моменту схвалення замовником виконаної роботи або, для угоди з поетапними платежами, до моменту схвалення конкретного етапу. Загальна комісія платформи за послуги становить 20% від вартості угоди для верифікованого фрилансера або 25% для неверифікованого облікового запису (див. Розділ 6) — і складається з двох компонентів: комісії банківської платіжної системи за транзакцію у розмірі 10% та комісії CDC Center за підтримку платформи у розмірі 10% (або, за правилом +5%, 15%).',
        'Фрилансер отримує чисту суму (вартість угоди за вирахуванням зазначеної вище комісії). Умовами вивільнення коштів з ескроу є: (a) пряме схвалення замовником виконаної роботи; (b) відсутність відповіді від замовника після закінчення узгодженого строку (автоматичне схвалення); або (c) адміністративне рішення, прийняте в межах процедури вирішення спорів (див. Розділ 14).',
        'Постачальник платіжних послуг (Bank of Georgia) діє відповідно до стандартів оновленої Директиви ЄС про платіжні послуги (PSD2), яка вимагає суворої автентифікації клієнта (Strong Customer Authentication, SCA) — включно, за необхідності, з додатковим кроком двофакторної або посиленої повторної автентифікації — у разі виявлення незвичайної, підозрілої або високоризикової активності (наприклад, вхід із незнайомої IP-адреси, нестандартного пристрою або запиту на зняття незвично великої суми) перед авторизацією платежу/виведення коштів.',
      ],
    },
    {
      heading: '8. Digital Store — розподіл доходу',
      paragraphs: [
        'У разі продажу товару через Digital Store загальна комісія платформи за послуги становить 20% від ціни продажу для верифікованого автора/творця або 25% для неверифікованого облікового запису (див. Розділ 6). Вона складається з двох компонентів: комісії банківської платіжної системи за транзакцію у розмірі 10% (Bank of Georgia) та комісії CDC Center за підтримку платформи у розмірі 10% (або, за правилом +5%, 15%).',
        'Автор/творець отримує чисту суму, яка автоматично зараховується на його внутрішній баланс профілю (Earnings Balance) одразу після успішного завершення оплати. Виведення коштів із цього внутрішнього балансу на особистий банківський рахунок здійснюється протягом 1 робочого дня з моменту подання запиту на виведення.',
      ],
    },
    {
      heading: '9. Digital Store — Інтелектуальна власність: продані та ліцензовані матеріали',
      paragraphs: [
        'Авторське право на товар у Digital Store (шаблон, файл дизайну, UI-кит, набір AI-промптів/ресурсів або інший цифровий актив) залишається за його автором/творцем — покупка не є передачею права власності, а натомість надає ліцензію на використання товару відповідно до типу ліцензії, визначеного творцем (наприклад, для особистого використання або для комерційного проєкту).',
        'Покупцю заборонено: перепродавати товар, поширювати його як самостійний продукт або видавати за власний оригінальний твір, якщо ліцензія прямо не надає такого права. На сторінці кожного товару перед покупкою зазначається конкретний тип і обсяг ліцензії.',
        'Для товарів, створених або відібраних безпосередньо самою CDC (без окремо зазначеного зовнішнього автора), натомість застосовується власна визначена ліцензія такого товару.',
      ],
    },
    {
      heading: '10. Сесії наставництва — Політика скасування та неявки',
      paragraphs: [
        'Безкоштовне скасування можливе не пізніше ніж за 12 годин до запланованої сесії — у цьому разі повна сума повертається за вирахуванням комісії за банківську транзакцію (див. Розділ 13).',
        'Якщо сесію скасовано менш ніж за 12 годин до запланованого часу, 50% сплаченої суми утримується платформою як компенсація за зарезервований час ментора; решта 50% повертається студенту.',
        'Якщо ментор не з\'явився на заплановану сесію (No-Show) і сесія не відбулася, студент отримує повне повернення (100%) сплаченої суми.',
        'Окремо, покупка курсу підлягає повному поверненню коштів протягом 24 годин з моменту покупки за певних умов — детальні правила див. в окремій Політиці повернення коштів (/refund-policy).',
      ],
    },
    {
      heading: '11. Поведінка користувачів',
      paragraphs: [
        'Заборонено: використання чужого облікового запису, обхід платформи для прямого контакту з метою уникнення оплати, шахрайство та порушення авторських прав.',
      ],
    },
    {
      heading: '12. Інтелектуальна власність платформи та курсів',
      paragraphs: [
        'Навчальні матеріали, відео та шаблони сертифікатів, створені безпосередньо CDC, є власністю CDC. Власники сертифікатів можуть використовувати свій сертифікат для особистого портфоліо. (Щодо окремого режиму інтелектуальної власності на товари сторонніх авторів у Digital Store — див. Розділ 9.)',
      ],
    },
    {
      heading: '13. Платежі, банківські комісії та рахунки-фактури',
      paragraphs: [
        'Платежі обробляються через Bank of Georgia (BOG) у грузинських ларі (₾). Ціни відповідають цінам, зазначеним на платформі на момент покупки.',
        'У разі повернення коштів за добровільним запитом користувача (включно з поверненнями за курси або сесії наставництва), з поверненої суми вираховується комісія за банківську транзакцію, вже сплачена під час обробки первинного платежу (приблизно 1,5%–2%). CDC Center не несе відповідальності за додаткові банківські витрати, спричинені помилкою користувача.',
        'Офіційний PDF-рахунок автоматично формується для кожної завершеної покупки, ескроу-транзакції та бронювання сесії наставництва з використанням даних покупця (ім\'я/назва компанії, електронна адреса, ідентифікаційний/податковий код), наданих під час оформлення замовлення або у профілі, для цілей бухгалтерського обліку.',
      ],
    },
    {
      heading: '14. Вирішення спорів щодо ескроу, дотримання PSD2/SCA та арбітраж',
      paragraphs: [
        'У разі виникнення спору щодо угоди, забезпеченої ескроу (наприклад, стосовно якості чи обсягу виконаної роботи), обидві сторони подають відповідні докази в межах процедури вирішення спорів платформи.',
        'CDC Center залишає за собою право ухвалити остаточне рішення на основі поданих доказів та визначити спосіб розподілу коштів, що утримуються на ескроу-рахунку, між сторонами. Це рішення не обмежує право будь-якої зі сторін на розгляд спору в суді відповідно до законодавства Грузії.',
        'Запити на виведення коштів підлягають внутрішньому процесу оцінки ризиків платформи (включно, за необхідності, з додатковою автентифікацією відповідно до вимог PSD2/SCA, див. Розділ 7) — запити з високим рівнем ризику передаються на ручний адміністративний розгляд замість автоматичного схвалення, щоб забезпечити безпеку процесу виплат.',
      ],
    },
    {
      heading: '15. Обмеження відповідальності',
      paragraphs: [
        'Платформа надається «як є» (as is). CDC не несе відповідальності за результати угод, укладених між користувачами на фриланс-маркетплейсі, крім випадків, передбачених законом.',
      ],
    },
    {
      heading: '16. Застосовне право',
      paragraphs: [
        'Ці умови регулюються законодавством Грузії. Спори підлягають розгляду компетентними судами Грузії.',
      ],
    },
    {
      heading: '17. Контакти',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Ідентифікаційний код 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  tr: [
    {
      heading: '1. Şartların Kabulü',
      paragraphs: [
        'Platformu (cdc.org.ge) kullanarak işbu Şartlar ve Koşulları kabul etmiş olursunuz. Platform, Digital Careers Center (CDC Georgia) (Kimlik Kodu 438737743) tarafından işletilmektedir.',
      ],
    },
    {
      heading: '2. Hizmetin Tanımı',
      paragraphs: [
        'CDC Platformu şunları bir araya getirir: çevrimiçi kurslar (video dersler, sertifikasyon), bir serbest çalışma/iş pazarı (anlaşmalar, emanet (escrow) hesaplaşması), mentorluk seansları, bir Digital Store, bir iş ilanları panosu ve bir topluluk forumu.',
        'CDC Center aracı bir platform olarak ve serbest çalışma anlaşmalarında bir emanet (escrow) acentesi olarak hareket eder — kullanıcılar arasındaki güvenli işlemleri kolaylaştırır, ancak bir müşteri ile bir serbest çalışan/mentor arasındaki belirli hizmet sözleşmesinin tarafı değildir.',
      ],
    },
    {
      heading: '3. Hesap Kaydı',
      paragraphs: [
        'Hizmetleri kullanmak için bir hesap oluşturmanız ve e-posta adresinizi doğrulamanız gerekir. Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.',
      ],
    },
    {
      heading: '4. Kursa Kayıt ve Erişim',
      paragraphs: [
        'Ödeme başarıyla tamamlandıktan sonra kurs erişimi anında (otomatik olarak) oluşturulur. Kurs içeriği yalnızca kişisel, ticari olmayan kullanım içindir.',
      ],
    },
    {
      heading: '5. Kullanıcı Doğrulaması ve Rozetler',
      paragraphs: [
        'Platform, birbirinden bağımsız üç doğrulama seviyesi sunar. İlgili kriterler karşılandığı takdirde bir kullanıcı aynı anda bir, iki veya üç rozetin tamamına sahip olabilir:',
        '🎓 "Doğrulanmış Öğrenci" — resmi bir CDC kursunun başarıyla tamamlanması üzerine (sertifikasyon sınavının geçilmesinin ardından otomatik olarak) veya yönetici tarafından onaylanmış mezuniyet statüsü üzerine verilir.',
        '⚡ "Doğrulanmış Serbest Çalışan" — resmi bir kimlik belgesi/pasaportun yüklenip bir yönetici tarafından onaylanmasının ardından verilir ve ayrıca serbest çalışanın tamamladığı, yapay zeka tarafından denetlenen, beceriye özgü Skill Verification Exams sınavlarına da dayanır.',
        '🏢 "Doğrulanmış İşletme" — bir şirket kayıt belgesinin (bir Ticaret Sicili özeti veya yabancı bir eşdeğeri) sunulup bir yönetici tarafından onaylanmasının ardından verilir.',
        'Doğrulama statüsü, tahsil edilen komisyonu doğrudan etkiler — bkz. Bölüm 6, "Doğrulanmamış Seviye Ek Ücreti (+%5)".',
      ],
    },
    {
      heading: '6. Doğrulanmamış Seviye Ek Ücreti (+%5)',
      paragraphs: [
        'Doğrulanmış bir hesaptan (bkz. Bölüm 5 — ilgili yol üzerinden Serbest Çalışan veya İşletme olarak doğrulanmış) platformun temel komisyon oranı (%20, bkz. Bölüm 7 ve 8) tahsil edilir.',
        'Doğrulanmamış (Standart) bir hesaptan, temel oranın üzerine ek olarak +%5 ek ücret tahsil edilir — yani hem Digital Store\'da hem de serbest çalışma pazarı emanet (escrow) işlemlerinde toplam %25 komisyon uygulanır.',
        'Komisyon oranı, anlaşmanın/satışın kaydedildiği anda satıcının/serbest çalışanın o andaki doğrulama statüsüne göre otomatik olarak belirlenir ve işleme kilitlenir — statüdeki sonraki bir değişiklik, zaten kaydedilmiş bir oranı geriye dönük olarak değiştirmez. Doğrulama (onay sonrasında) verildiğinde, sonraki işlemlere hemen uygulanır.',
      ],
    },
    {
      heading: '7. Serbest Çalışma Pazarı ve Emanet (Escrow)',
      paragraphs: [
        'Bir anlaşmaya ait fonlar, müşteri teslim edilen işi onaylayana kadar veya kilometre taşına dayalı bir anlaşmada ilgili kilometre taşı onaylanana kadar emanette tutulur. Platformun toplam hizmet ücreti, doğrulanmış bir serbest çalışan için anlaşma değerinin %20\'si, doğrulanmamış bir hesap için ise %25\'idir (bkz. Bölüm 6) — bu ücret iki bileşenden oluşur: %10 banka ödeme sistemi işlem ücreti ve %10 (veya +%5 kuralı kapsamında %15) CDC Center platform destek ücreti.',
        'Serbest çalışan, net tutarı (anlaşma değerinden yukarıdaki komisyonun düşülmesiyle) alır. Emanet serbest bırakma koşulları şunlardır: (a) müşterinin teslim edilen işi doğrudan onaylaması; (b) üzerinde anlaşılan sürenin dolmasından sonra müşteriden yanıt alınamaması (otomatik onay); veya (c) anlaşmazlık çözüm süreci yoluyla varılan idari bir karar (bkz. Bölüm 14).',
        'Ödeme hizmeti sağlayıcısı (Bank of Georgia), ödeme/para çekme işlemini yetkilendirmeden önce olağandışı, şüpheli veya yüksek riskli bir etkinlik tespit edildiğinde (örn. tanıdık olmayan bir IP adresinden giriş, standart olmayan bir cihaz veya olağandışı derecede büyük bir para çekme talebi), gerektiğinde ek bir iki faktörlü veya güçlendirilmiş yeniden kimlik doğrulama adımı da dahil olmak üzere Güçlü Müşteri Kimlik Doğrulaması (SCA) gerektiren, AB\'nin revize edilmiş Ödeme Hizmetleri Direktifi (PSD2) standartlarına uygun olarak faaliyet gösterir.',
      ],
    },
    {
      heading: '8. Digital Store — Gelir Paylaşımı',
      paragraphs: [
        'Digital Store üzerinden bir ürün satıldığında, platformun toplam hizmet ücreti doğrulanmış bir yaratıcı için satış fiyatının %20\'si, doğrulanmamış bir hesap için ise %25\'idir (bkz. Bölüm 6). Bu ücret iki bileşenden oluşur: %10 banka ödeme sistemi işlem ücreti (Bank of Georgia) ve %10 (veya +%5 kuralı kapsamında %15) CDC Center platform destek ücreti.',
        'Yaratıcı, ödemenin başarıyla tamamlanmasının hemen ardından dahili profil bakiyesine (Earnings Balance) otomatik olarak yatırılan net tutarı alır. Bu dahili bakiyeden kişisel bir banka hesabına para çekme işlemi, para çekme talebinin gönderilmesinden itibaren 1 iş günü içinde işleme alınır.',
      ],
    },
    {
      heading: '9. Digital Store — Fikri Mülkiyet: Satılan İçerik ve Lisanslı İçerik',
      paragraphs: [
        'Bir Digital Store ürünündeki (bir şablon, tasarım dosyası, UI kiti, AI prompt/kaynak paketi veya başka bir dijital varlık) telif hakkı, yaratıcısında kalır — bir satın alma işlemi mülkiyet devri teşkil etmez, bunun yerine yaratıcının belirlediği lisans türü (örneğin kişisel kullanım veya ticari bir proje için) kapsamında ürünü kullanma lisansı verir.',
        'Alıcının şunları yapmasına izin verilmez: ürünü yeniden satmak, bağımsız bir ürün olarak yeniden dağıtmak veya lisans açıkça böyle bir hak vermedikçe kendi özgün eseriymiş gibi sunmak. Her ürünün sayfasında, satın alma öncesinde kendine özgü lisans türü ve kapsamı belirtilir.',
        'Doğrudan CDC\'nin kendisi tarafından oluşturulan veya derlenen ürünler için (ayrıca atfedilmiş dış bir yaratıcı olmaksızın), bunun yerine o ürüne özgü belirtilen lisans geçerlidir.',
      ],
    },
    {
      heading: '10. Mentorluk Seansları — İptal ve Gelmeme Politikası',
      paragraphs: [
        'Planlanan seanstan en az 12 saat önce ücretsiz iptal mümkündür — bu durumda banka işlem ücreti düşüldükten sonra tam tutar iade edilir (bkz. Bölüm 13).',
        'Bir seans, planlanan zamandan 12 saatten daha az bir süre önce iptal edilirse, ödenen tutarın %50\'si mentorun ayrılmış zamanının tazminatı olarak platformda kalır; kalan %50 öğrenciye iade edilir.',
        'Mentor planlanan seansa katılmazsa (Gelmeme) ve seans gerçekleşmezse, öğrenciye ödenen tutarın %100\'ü iade edilir.',
        'Ayrıca, bir kurs satın alma işlemi, belirli koşullar altında satın alımdan itibaren 24 saat içinde tamamen iade edilebilir — ayrıntılı kurallar için bağımsız İade Politikasına (/refund-policy) bakınız.',
      ],
    },
    {
      heading: '11. Kullanıcı Davranışı',
      paragraphs: [
        'Yasaktır: başkasının hesabını kullanmak, ödemeden kaçınmak amacıyla platformu atlayarak doğrudan iletişim kurmak, dolandırıcılık ve telif hakkı ihlali.',
      ],
    },
    {
      heading: '12. Platform ve Kurs Fikri Mülkiyeti',
      paragraphs: [
        'Doğrudan CDC tarafından oluşturulan kurs materyalleri, videolar ve sertifika şablonları CDC\'nin mülkiyetindedir. Sertifika sahipleri, sertifikalarını kişisel portföy amaçlarıyla kullanabilirler. (Digital Store\'daki üçüncü taraf ürünlerini yöneten ayrı fikri mülkiyet rejimi için bkz. Bölüm 9.)',
      ],
    },
    {
      heading: '13. Ödemeler, Banka Ücretleri ve Faturalar',
      paragraphs: [
        'Ödemeler, Gürcistan Larisi (₾) cinsinden Bank of Georgia (BOG) aracılığıyla işlenir. Fiyatlar, satın alma anında platformda görüntülendiği şekildedir.',
        'Kullanıcının gönüllü talebi üzerine yapılan iadelerde (kurs veya mentorluk seansı iadeleri dahil), orijinal ödeme işlenirken zaten oluşan banka işlem ücreti (yaklaşık %1,5–%2) iade edilen tutardan düşülür. CDC Center, kullanıcı hatasından kaynaklanan ek banka masraflarından sorumlu değildir.',
        'Ödeme sırasında veya profilde sağlanan alıcı bilgileri (ad/şirket, e-posta, kimlik/vergi kodu) kullanılarak, muhasebe amaçlarıyla, tamamlanan her satın alma, emanet işlemi ve mentorluk rezervasyonu için otomatik olarak resmi bir PDF fatura oluşturulur.',
      ],
    },
    {
      heading: '14. Emanet Anlaşmazlık Çözümü, PSD2/SCA Uyumluluğu ve Tahkim',
      paragraphs: [
        'Emanet ile finanse edilen bir anlaşmayla ilgili bir anlaşmazlık durumunda (örneğin teslim edilen işin kalitesi veya kapsamı hakkında), her iki taraf da platformun anlaşmazlık çözüm süreci kapsamında ilgili kanıtları sunar.',
        'CDC Center, sunulan kanıtlara dayanarak nihai bir karar verme ve emanette tutulan fonların taraflar arasında nasıl paylaştırılacağına karar verme hakkını saklı tutar. Bu karar, taraflardan herhangi birinin anlaşmazlığı Gürcistan hukuku uyarınca mahkemede sürdürme hakkını sınırlamaz.',
        'Para çekme talepleri, platformun dahili risk değerlendirme sürecine tabidir (gerektiğinde PSD2/SCA uyumlu ek kimlik doğrulaması dahil, bkz. Bölüm 7) — ödeme sürecini güvenli tutmak amacıyla yüksek riskli talepler otomatik onay yerine manuel idari incelemeye yönlendirilir.',
      ],
    },
    {
      heading: '15. Sorumluluğun Sınırlandırılması',
      paragraphs: [
        'Platform "olduğu gibi" sunulmaktadır. CDC, kanunun gerektirdiği durumlar dışında, serbest çalışma pazarında kullanıcılar arasında yapılan anlaşmaların sonuçlarından sorumlu değildir.',
      ],
    },
    {
      heading: '16. Uygulanacak Hukuk',
      paragraphs: [
        'İşbu şartlar Gürcistan yasalarına tabidir. Anlaşmazlıklar Gürcistan\'ın yetkili mahkemelerine tabidir.',
      ],
    },
    {
      heading: '17. İletişim',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Kimlik Kodu 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  hy: [
    {
      heading: '1. Պայմանների Ընդունում',
      paragraphs: [
        'Օգտագործելով հարթակը (cdc.org.ge)՝ դուք ընդունում եք սույն Պայմանները և Դրույթները։ Հարթակը կառավարվում է Digital Careers Center (CDC Georgia)-ի կողմից (Նույնականացման կոդ՝ 438737743)։',
      ],
    },
    {
      heading: '2. Ծառայության Նկարագրություն',
      paragraphs: [
        'CDC հարթակը միավորում է՝ առցանց դասընթացներ (տեսադասեր, սերտիֆիկացում), ֆրիլանս/աշխատանքային շուկա (գործարքներ, էսքրոու հաշվարկներ), մենթորության սեսիաներ, Digital Store, աշխատատեղերի ցուցատախտակ և համայնքային ֆորում։',
        'CDC Center-ը հանդես է գալիս որպես միջնորդ հարթակ, իսկ ֆրիլանս գործարքներում՝ որպես էսքրոու գործակալ — այն նպաստում է անվտանգ գործարքների կատարմանը օգտատերերի միջև, սակայն չի հանդիսանում կողմ պատվիրատուի և ֆրիլանսերի/մենթորի միջև կոնկրետ ծառայության պայմանագրում։',
      ],
    },
    {
      heading: '3. Հաշվի Գրանցում',
      paragraphs: [
        'Ծառայություններից օգտվելու համար անհրաժեշտ է ստեղծել հաշիվ և հաստատել ձեր էլ. փոստը։ Դուք պատասխանատու եք ձեր հաշվի տվյալների անվտանգության համար։',
      ],
    },
    {
      heading: '4. Դասընթացի Գրանցում և Հասանելիություն',
      paragraphs: [
        'Վճարման հաջող ավարտից հետո դասընթացի հասանելիությունը ստեղծվում է անհապաղ (ավտոմատ)։ Դասընթացի բովանդակությունը նախատեսված է միայն անձնական, ոչ առևտրային օգտագործման համար։',
      ],
    },
    {
      heading: '5. Օգտատերերի Վավերացում և Կրծքանշաններ',
      paragraphs: [
        'Հարթակն առաջարկում է երեք անկախ վավերացման մակարդակ։ Օգտատերը կարող է միաժամանակ ունենալ մեկ, երկու կամ երեքն էլ կրծքանշանները՝ պայմանով, որ բավարարվում են համապատասխան չափանիշները.',
        '🎓 «Վավերացված Ուսանող» — շնորհվում է պաշտոնական CDC դասընթացը հաջողությամբ ավարտելուց հետո (ավտոմատ կերպով՝ սերտիֆիկացման քննությունը հանձնելուց հետո) կամ ադմինիստրատորի կողմից հաստատված շրջանավարտի կարգավիճակի հիման վրա։',
        '⚡ «Վավերացված Ֆրիլանսեր» — շնորհվում է անձը հաստատող փաստաթուղթ/անձնագիր վերբեռնելուց և ադմինիստրատորի կողմից հաստատվելուց հետո, ինչպես նաև հիմնված է AI-վերահսկվող, հմտության-կոնկրետ Skill Verification Exams քննությունների վրա, որոնք հանձնում է ֆրիլանսերը։',
        '🏢 «Վավերացված Բիզնես» — շնորհվում է ընկերության գրանցման փաստաթուղթ (Հանրային ռեգիստրի քաղվածք կամ արտասահմանյան համարժեք) ներկայացնելուց և ադմինիստրատորի կողմից հաստատվելուց հետո։',
        'Վավերացման կարգավիճակն ուղղակիորեն ազդում է գանձվող միջնորդավճարի վրա — տես Բաժին 6, «Չվավերացված Մակարդակի Հավելավճար (+5%)»։',
      ],
    },
    {
      heading: '6. Չվավերացված Մակարդակի Հավելավճար (+5%)',
      paragraphs: [
        'Վավերացված հաշվից (տես Բաժին 5 — վավերացված որպես Ֆրիլանսեր կամ Բիզնես՝ համապատասխան ուղիով) գանձվում է հարթակի բազային միջնորդավճարի դրույքաչափը (20%, տես Բաժիններ 7 և 8)։',
        'Չվավերացված (Ստանդարտ) հաշվից գանձվում է լրացուցիչ +5% հավելավճար՝ բազային դրույքաչափի վրա — այսինքն՝ ընդհանուր 25% միջնորդավճար, ինչպես Digital Store-ում, այնպես էլ ֆրիլանս-շուկայի էսքրոու գործարքներում։',
        'Միջնորդավճարի դրույքաչափը որոշվում է ավտոմատ կերպով՝ գործարքի/վաճառքի գրանցման պահին, ելնելով վաճառողի/ֆրիլանսերի այդ պահի վավերացման կարգավիճակից, և ամրագրվում է գործարքի վրա — կարգավիճակի հետագա փոփոխությունը հետադարձ ուժով չի փոխում արդեն գրանցված դրույքաչափը։ Վավերացումը շնորհվելուց հետո (հաստատումից հետո) այն անմիջապես կիրառվում է հետագա գործարքների նկատմամբ։',
      ],
    },
    {
      heading: '7. Ֆրիլանս Շուկա և Էսքրոու',
      paragraphs: [
        'Գործարքի համար նախատեսված միջոցները պահվում են էսքրոուում, մինչև պատվիրատուն հաստատի կատարված աշխատանքը, կամ, փուլային գործարքի դեպքում, մինչև կոնկրետ փուլի հաստատումը։ Հարթակի ընդհանուր սպասարկման վճարը կազմում է գործարքի արժեքի 20%-ը վավերացված ֆրիլանսերի համար, կամ 25%-ը՝ չվավերացված հաշվի համար (տես Բաժին 6) — բաղկացած երկու բաղադրիչից՝ 10% բանկային վճարային համակարգի գործարքի վճար և 10% (կամ, +5% կանոնի համաձայն, 15%) CDC Center հարթակի աջակցության վճար։',
        'Ֆրիլանսերը ստանում է զուտ գումարը (գործարքի արժեքը՝ հանած վերոնշյալ միջնորդավճարը)։ Էսքրոուի ազատման պայմաններն են՝ (ա) պատվիրատուի կողմից կատարված աշխատանքի ուղղակի հաստատումը. (բ) համաձայնեցված ժամկետի ավարտից հետո պատվիրատուից պատասխանի բացակայությունը (ավտոմատ հաստատում). կամ (գ) վեճերի լուծման գործընթացի արդյունքում կայացված վարչական որոշում (տես Բաժին 14)։',
        'Վճարային ծառայությունների մատակարարը (Bank of Georgia) գործում է ԵՄ-ի վերանայված Վճարային Ծառայությունների Դիրեկտիվի (PSD2) չափանիշներին համապատասխան, որը պահանջում է Հաճախորդի Ուժեղացված Նույնականացում (SCA) — ներառյալ, անհրաժեշտության դեպքում, լրացուցիչ երկգործոն կամ ուժեղացված կրկնանույնականացման քայլ — երբ հայտնաբերվում է անսովոր, կասկածելի կամ բարձր ռիսկային գործունեություն (օրինակ՝ մուտք անծանոթ IP հասցեից, ոչ ստանդարտ սարքից, կամ արտասովոր մեծ գումարի դուրսբերման հայտ)՝ նախքան վճարման/դուրսբերման թույլտվությունը։',
      ],
    },
    {
      heading: '8. Digital Store — Եկամտի Բաշխում',
      paragraphs: [
        'Երբ ապրանքը վաճառվում է Digital Store-ի միջոցով, հարթակի ընդհանուր սպասարկման վճարը կազմում է վաճառքի գնի 20%-ը վավերացված ստեղծողի համար, կամ 25%-ը՝ չվավերացված հաշվի համար (տես Բաժին 6)։ Այն բաղկացած է երկու բաղադրիչից՝ 10% բանկային վճարային համակարգի գործարքի վճար (Bank of Georgia) և 10% (կամ, +5% կանոնի համաձայն, 15%) CDC Center հարթակի աջակցության վճար։',
        'Ստեղծողը ստանում է զուտ գումարը, որն ավտոմատ կերպով մուտքագրվում է իր ներքին պրոֆիլի հաշվեկշռին (Earnings Balance)՝ վճարման հաջող ավարտից անմիջապես հետո։ Այդ ներքին հաշվեկշռից միջոցների դուրսբերումը անձնական բանկային հաշվին մշակվում է դուրսբերման հայտի ներկայացումից 1 աշխատանքային օրվա ընթացքում։',
      ],
    },
    {
      heading: '9. Digital Store — Մտավոր Սեփականություն. Վաճառված ընդդեմ Լիցենզավորված Բովանդակության',
      paragraphs: [
        'Digital Store ապրանքի (ձևանմուշ, դիզայնի ֆայլ, UI փաթեթ, AI հուշման/ռեսուրսների փաթեթ, կամ այլ թվային ակտիվ) հեղինակային իրավունքը մնում է դրա ստեղծողի մոտ — գնումը հանդիսանում է ոչ թե սեփականության փոխանցում, այլ տրամադրում է ապրանքն օգտագործելու լիցենզիա՝ ստեղծողի կողմից նշված լիցենզիայի տեսակի համաձայն (օրինակ՝ անձնական օգտագործման կամ առևտրային նախագծի համար)։',
        'Գնորդին չի թույլատրվում՝ վերավաճառել ապրանքը, տարածել այն որպես առանձին ապրանք, կամ ներկայացնել այն որպես սեփական ինքնատիպ աշխատանք, եթե լիցենզիան բացահայտորեն չի տրամադրում այդպիսի իրավունք։ Յուրաքանչյուր ապրանքի էջում գնումից առաջ նշվում է դրա կոնկրետ լիցենզիայի տեսակը և շրջանակը։',
        'Անմիջապես CDC-ի կողմից ստեղծված կամ համալրված ապրանքների համար (առանց առանձին նշված արտաքին ստեղծողի)՝ փոխարենը կիրառվում է տվյալ ապրանքի սեփական նշված լիցենզիան։',
      ],
    },
    {
      heading: '10. Մենթորության Սեսիաներ — Չեղարկման և Չներկայանալու Քաղաքականություն',
      paragraphs: [
        'Անվճար չեղարկումը հնարավոր է նախատեսված սեսիայից առնվազն 12 ժամ առաջ — այս դեպքում ամբողջ գումարը վերադարձվում է՝ հանած բանկային գործարքի վճարը (տես Բաժին 13)։',
        'Եթե սեսիան չեղարկվում է նախատեսված ժամանակից 12 ժամից պակաս ժամանակ առաջ, վճարված գումարի 50%-ը մնում է հարթակի մոտ՝ որպես մենթորի ամրագրված ժամանակի փոխհատուցում. մնացած 50%-ը վերադարձվում է ուսանողին։',
        'Եթե մենթորը չի ներկայանում նախատեսված սեսիային (Չներկայանալ) և սեսիան տեղի չի ունենում, ուսանողին վերադարձվում է վճարված գումարի 100%-ը։',
        'Առանձին, դասընթացի գնումը լիովին վերադարձելի է գնումից հետո 24 ժամվա ընթացքում՝ որոշակի պայմաններով — մանրամասն կանոնների համար տես առանձին Վերադարձի Քաղաքականությունը (/refund-policy)։',
      ],
    },
    {
      heading: '11. Օգտատերերի Վարքագիծ',
      paragraphs: [
        'Արգելվում է՝ ուրիշի հաշվի օգտագործումը, հարթակը շրջանցելով ուղղակի կապ հաստատելը՝ վճարումից խուսափելու նպատակով, խարդախությունը և հեղինակային իրավունքի խախտումը։',
      ],
    },
    {
      heading: '12. Հարթակի և Դասընթացի Մտավոր Սեփականություն',
      paragraphs: [
        'Անմիջապես CDC-ի կողմից ստեղծված դասընթացի նյութերը, տեսանյութերը և սերտիֆիկատի ձևանմուշները հանդիսանում են CDC-ի սեփականությունը։ Սերտիֆիկատի սեփականատերերը կարող են օգտագործել իրենց սերտիֆիկատը անձնական պորտֆոլիոյի նպատակներով։ (Digital Store-ի երրորդ կողմի ապրանքները կարգավորող առանձին մտավոր սեփականության ռեժիմի համար տես Բաժին 9։)',
      ],
    },
    {
      heading: '13. Վճարումներ, Բանկային Վճարներ և Հաշիվ-ապրանքագրեր',
      paragraphs: [
        'Վճարումները մշակվում են Bank of Georgia (BOG)-ի միջոցով՝ վրացական լարիով (₾)։ Գները ցուցադրված են հարթակում գնման պահին։',
        'Օգտատիրոջ կամավոր հայտի հիման վրա իրականացվող վերադարձների դեպքում (ներառյալ դասընթացի կամ մենթորության սեսիայի վերադարձները), սկզբնական վճարումը մշակելիս արդեն գանձված բանկային գործարքի վճարը (մոտավորապես 1.5%–2%) հանվում է վերադարձվող գումարից։ CDC Center-ը պատասխանատու չէ օգտատիրոջ սխալի հետևանքով առաջացած լրացուցիչ բանկային ծախսերի համար։',
        'Յուրաքանչյուր ավարտված գնման, էսքրոու գործարքի և մենթորության ամրագրման համար ավտոմատ կերպով ստեղծվում է պաշտոնական PDF հաշիվ-ապրանքագիր՝ օգտագործելով գնման ընթացքում կամ պրոֆիլում տրամադրված գնորդի տվյալները (անուն/ընկերություն, էլ. փոստ, նույնականացման/հարկային կոդ)՝ հաշվապահական նպատակներով։',
      ],
    },
    {
      heading: '14. Էսքրոուի Վեճերի Լուծում, PSD2/SCA Համապատասխանություն և Արբիտրաժ',
      paragraphs: [
        'Էսքրոուով ֆինանսավորված գործարքի հետ կապված վեճի դեպքում (օրինակ՝ կատարված աշխատանքի որակի կամ ծավալի վերաբերյալ), երկու կողմերն էլ ներկայացնում են համապատասխան ապացույցներ հարթակի վեճերի լուծման գործընթացի շրջանակներում։',
        'CDC Center-ը իրավունք է վերապահում ներկայացված ապացույցների հիման վրա կայացնել վերջնական որոշում և որոշել, թե ինչպես բաշխվեն էսքրոուում պահվող միջոցները կողմերի միջև։ Այս որոշումը չի սահմանափակում որևէ կողմի իրավունքը վեճը շարունակելու դատարանում՝ վրացական օրենսդրության համաձայն։',
        'Դուրսբերման հայտերը ենթակա են հարթակի ներքին ռիսկերի գնահատման գործընթացին (ներառյալ, անհրաժեշտության դեպքում, PSD2/SCA-համապատասխան լրացուցիչ նույնականացում, տես Բաժին 7) — բարձր ռիսկային հայտերն ուղարկվում են ձեռքով վարչական վերանայման՝ ավտոմատ հաստատման փոխարեն, վճարման գործընթացի անվտանգությունն ապահովելու համար։',
      ],
    },
    {
      heading: '15. Պատասխանատվության Սահմանափակում',
      paragraphs: [
        'Հարթակը տրամադրվում է «ինչպես կա» սկզբունքով։ CDC-ն պատասխանատու չէ ֆրիլանս շուկայում օգտատերերի միջև կնքված գործարքների արդյունքների համար, բացառությամբ օրենքով նախատեսված դեպքերի։',
      ],
    },
    {
      heading: '16. Կիրառելի Օրենսդրություն',
      paragraphs: [
        'Սույն պայմանները կարգավորվում են Վրաստանի օրենսդրությամբ։ Վեճերը ենթակա են Վրաստանի իրավասու դատարանների քննությանը։',
      ],
    },
    {
      heading: '17. Կապ',
      paragraphs: ['Digital Careers Center (CDC Georgia) (Նույնականացման կոդ՝ 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
    },
  ],
  az: [
    {
      heading: '1. Şərtlərin Qəbulu',
      paragraphs: [
        'Platformadan (cdc.org.ge) istifadə etməklə siz bu Şərtlər və Qaydaları qəbul edirsiniz. Platforma Digital Careers Center (CDC Georgia) (ID Kodu 438737743) tərəfindən idarə olunur.',
      ],
    },
    {
      heading: '2. Xidmətin Təsviri',
      paragraphs: [
        'CDC Platforması aşağıdakıları birləşdirir: onlayn kurslar (video dərslər, sertifikatlaşdırma), freelancer/iş bazarı (sövdələşmələr, escrow hesablaşması), mentorluq sessiyaları, Digital Store, iş elanları lövhəsi və icma forumu.',
        'CDC Center vasitəçi platforma kimi, freelancer sövdələşmələrində isə escrow agenti kimi çıxış edir — istifadəçilər arasında təhlükəsiz əməliyyatlara kömək edir, lakin müştəri ilə freelancer/mentor arasındakı konkret xidmət müqaviləsinin tərəfi deyil.',
      ],
    },
    {
      heading: '3. Hesab Qeydiyyatı',
      paragraphs: [
        'Xidmətlərdən istifadə etmək üçün hesab yaratmaq və e-poçtunuzu təsdiqləmək tələb olunur. Hesab məlumatlarınızın təhlükəsizliyinə görə siz məsuliyyət daşıyırsınız.',
      ],
    },
    {
      heading: '4. Kursa Qeydiyyat və Giriş',
      paragraphs: [
        'Ödəniş uğurla tamamlandıqdan sonra kursa giriş dərhal (avtomatik) yaradılır. Kurs məzmunu yalnız şəxsi, qeyri-kommersiya istifadəsi üçündür.',
      ],
    },
    {
      heading: '5. İstifadəçi Doğrulaması və Nişanlar',
      paragraphs: [
        'Platforma üç müstəqil doğrulama səviyyəsi təklif edir. Müvafiq meyarlar ödənildiyi təqdirdə istifadəçi eyni vaxtda bir, iki və ya hər üç nişana sahib ola bilər:',
        '🎓 "Təsdiqlənmiş Tələbə" — rəsmi CDC kursunun uğurla tamamlanması əsasında (sertifikatlaşdırma imtahanından keçdikdən sonra avtomatik olaraq) və ya administrator tərəfindən təsdiqlənmiş məzun statusu əsasında verilir.',
        '⚡ "Təsdiqlənmiş Freelancer" — rəsmi şəxsiyyət vəsiqəsi/pasport sənədinin yüklənməsi və administrator tərəfindən təsdiqlənməsindən sonra verilir, həmçinin freelancer-in tamamladığı, AI tərəfindən nəzarət edilən, bacarığa xas Skill Verification Exams imtahanlarına əsaslanır.',
        '🏢 "Təsdiqlənmiş Biznes" — şirkət qeydiyyat sənədinin (Dövlət Reyestrindən çıxarış və ya xarici ekvivalenti) təqdim edilməsi və administrator tərəfindən təsdiqlənməsindən sonra verilir.',
        'Doğrulama statusu tutulan komissiyaya birbaşa təsir edir — bax Bölmə 6, "Təsdiqlənməmiş Səviyyə Əlavə Haqqı (+5%)".',
      ],
    },
    {
      heading: '6. Təsdiqlənməmiş Səviyyə Əlavə Haqqı (+5%)',
      paragraphs: [
        'Təsdiqlənmiş hesabdan (bax Bölmə 5 — müvafiq trek vasitəsilə Freelancer və ya Biznes kimi təsdiqlənmiş) platformanın baza komissiya dərəcəsi (20%, bax Bölmə 7 və 8) tutulur.',
        'Təsdiqlənməmiş (Standart) hesabdan baza dərəcəsi üzərinə əlavə +5% haqq tutulur — yəni həm Digital Store-da, həm də freelancer-bazarı escrow əməliyyatlarında ümumi 25% komissiya.',
        'Komissiya dərəcəsi avtomatik olaraq, sövdələşmənin/satışın qeydə alındığı anda satıcının/freelancer-in o anki doğrulama statusuna əsasən müəyyən edilir və əməliyyata sabitlənir — statusun sonrakı dəyişikliyi artıq qeydə alınmış dərəcəni geriyə dönük olaraq dəyişmir. Doğrulama verildikdən (təsdiqlənmədən) sonra dərhal növbəti əməliyyatlara tətbiq olunur.',
      ],
    },
    {
      heading: '7. Freelancer Bazarı və Escrow',
      paragraphs: [
        'Sövdələşmə üçün vəsaitlər, müştəri təhvil verilən işi təsdiqləyənə qədər, mərhələ əsaslı sövdələşmə üçün isə konkret mərhələ təsdiqlənənə qədər escrow-da saxlanılır. Platformanın ümumi xidmət haqqı təsdiqlənmiş freelancer üçün sövdələşmə dəyərinin 20%-i, təsdiqlənməmiş hesab üçün isə 25%-i təşkil edir (bax Bölmə 6) — iki komponentdən ibarətdir: 10% bank ödəniş sistemi əməliyyat haqqı və 10% (və ya +5% qaydasına əsasən 15%) CDC Center platforma dəstək haqqı.',
        'Freelancer xalis məbləği (sövdələşmə dəyərindən yuxarıdakı komissiya çıxılmaqla) alır. Escrow-un sərbəst buraxılma şərtləri bunlardır: (a) müştərinin təhvil verilən işi birbaşa təsdiqləməsi; (b) razılaşdırılmış müddət bitdikdən sonra müştəridən cavab alınmaması (avtomatik təsdiq); və ya (c) mübahisə həlli prosesi vasitəsilə əldə edilmiş inzibati qərar (bax Bölmə 14).',
        'Ödəniş xidməti provayderi (Bank of Georgia) ödənişi/pul çıxarılmasını icazələndirməzdən əvvəl qeyri-adi, şübhəli və ya yüksək riskli fəaliyyət aşkar edildikdə (məsələn, tanış olmayan IP ünvanından giriş, qeyri-standart cihaz və ya qeyri-adi dərəcədə böyük məbləğdə pul çıxarma tələbi), zəruri hallarda əlavə ikifaktorlu və ya gücləndirilmiş yenidən autentifikasiya addımı daxil olmaqla, Güclü Müştəri Autentifikasiyası (SCA) tələb edən AB-nin yenilənmiş Ödəniş Xidmətləri Direktivi (PSD2) standartlarına uyğun fəaliyyət göstərir.',
      ],
    },
    {
      heading: '8. Digital Store — Gəlirin Bölüşdürülməsi',
      paragraphs: [
        'Məhsul Digital Store vasitəsilə satıldıqda, platformanın ümumi xidmət haqqı təsdiqlənmiş yaradıcı üçün satış qiymətinin 20%-i, təsdiqlənməmiş hesab üçün isə 25%-i təşkil edir (bax Bölmə 6). Bu, iki komponentdən ibarətdir: 10% bank ödəniş sistemi əməliyyat haqqı (Bank of Georgia) və 10% (və ya +5% qaydasına əsasən 15%) CDC Center platforma dəstək haqqı.',
        'Yaradıcı, ödəniş uğurla tamamlandıqdan dərhal sonra öz daxili profil balansına (Earnings Balance) avtomatik olaraq köçürülən xalis məbləği alır. Bu daxili balansdan şəxsi bank hesabına vəsaitin çıxarılması, çıxarma tələbinin göndərilməsindən 1 iş günü ərzində həyata keçirilir.',
      ],
    },
    {
      heading: '9. Digital Store — Əqli Mülkiyyət: Satılan və Lisenziyalı Məzmun',
      paragraphs: [
        'Digital Store məhsuluna (şablon, dizayn faylı, UI dəsti, AI prompt/resurs paketi və ya digər rəqəmsal aktiv) müəllif hüququ onun yaradıcısında qalır — satın alma mülkiyyət hüququnun ötürülməsi demək deyil, əksinə yaradıcının müəyyən etdiyi lisenziya növünə uyğun olaraq (məsələn, şəxsi istifadə və ya kommersiya layihəsi üçün) məhsuldan istifadə lisenziyası verir.',
        'Alıcıya aşağıdakılara icazə verilmir: məhsulu yenidən satmaq, onu müstəqil məhsul kimi yenidən yaymaq və ya lisenziya açıq şəkildə belə bir hüquq vermədiyi halda onu öz orijinal işi kimi təqdim etmək. Hər bir məhsulun səhifəsində satın almadan əvvəl onun konkret lisenziya növü və əhatə dairəsi göstərilir.',
        'Birbaşa CDC-nin özü tərəfindən yaradılan və ya seçilən məhsullar üçün (ayrıca göstərilmiş xarici yaradıcı olmadan) əvəzinə həmin məhsul üçün göstərilən öz lisenziyası tətbiq olunur.',
      ],
    },
    {
      heading: '10. Mentorluq Sessiyaları — Ləğvetmə və İştirak Etməmə Siyasəti',
      paragraphs: [
        'Planlaşdırılan sessiyadan ən azı 12 saat əvvəl pulsuz ləğvetmə mümkündür — bu halda bank əməliyyat haqqı çıxılmaqla tam məbləğ geri qaytarılır (bax Bölmə 13).',
        'Sessiya planlaşdırılan vaxtdan 12 saatdan az müddət əvvəl ləğv edilərsə, ödənilmiş məbləğin 50%-i mentorun ayrılmış vaxtının kompensasiyası kimi platformada qalır; qalan 50% tələbəyə geri qaytarılır.',
        'Mentor planlaşdırılan sessiyaya gəlmirsə (İştirak Etməmə) və sessiya baş tutmursa, tələbəyə ödənilmiş məbləğin 100%-i geri qaytarılır.',
        'Ayrıca, kurs alışı müəyyən şərtlər daxilində satın almadan sonra 24 saat ərzində tam geri qaytarıla bilər — ətraflı qaydalar üçün ayrıca Geri Qaytarma Siyasətinə (/refund-policy) baxın.',
      ],
    },
    {
      heading: '11. İstifadəçi Davranışı',
      paragraphs: [
        'Qadağandır: başqasının hesabından istifadə etmək, ödənişdən yayınmaq məqsədilə platformanı yan keçərək birbaşa əlaqə qurmaq, fırıldaqçılıq və müəllif hüquqlarının pozulması.',
      ],
    },
    {
      heading: '12. Platforma və Kurs Əqli Mülkiyyəti',
      paragraphs: [
        'Birbaşa CDC tərəfindən yaradılan kurs materialları, videolar və sertifikat şablonları CDC-nin mülkiyyətidir. Sertifikat sahibləri sertifikatlarından şəxsi portfolio məqsədləri üçün istifadə edə bilərlər. (Digital Store-dakı üçüncü tərəf məhsullarını tənzimləyən ayrıca əqli mülkiyyət rejimi üçün bax Bölmə 9.)',
      ],
    },
    {
      heading: '13. Ödənişlər, Bank Haqları və Fakturalar',
      paragraphs: [
        'Ödənişlər Gürcüstan Larisi (₾) ilə Bank of Georgia (BOG) vasitəsilə həyata keçirilir. Qiymətlər satın alma anında platformada göstərildiyi kimidir.',
        'İstifadəçinin könüllü tələbi ilə həyata keçirilən geri qaytarmalarda (kurs və ya mentorluq sessiyası geri qaytarmaları daxil olmaqla), ilkin ödənişin emalı zamanı artıq yaranmış bank əməliyyat haqqı (təxminən 1.5%–2%) geri qaytarılan məbləğdən çıxılır. CDC Center istifadəçi səhvi nəticəsində yaranan əlavə bank xərclərinə görə məsuliyyət daşımır.',
        'Hər bir tamamlanmış alış, escrow əməliyyatı və mentorluq bronlaşdırması üçün ödəniş zamanı və ya profildə göstərilən alıcı məlumatlarından (ad/şirkət, e-poçt, identifikasiya/vergi kodu) istifadə edərək mühasibat məqsədləri üçün avtomatik olaraq rəsmi PDF faktura yaradılır.',
      ],
    },
    {
      heading: '14. Escrow Mübahisələrinin Həlli, PSD2/SCA Uyğunluğu və Arbitraj',
      paragraphs: [
        'Escrow ilə maliyyələşdirilən sövdələşmə ilə bağlı mübahisə yarandıqda (məsələn, təhvil verilən işin keyfiyyəti və ya həcmi ilə bağlı), hər iki tərəf platformanın mübahisə həlli prosesi çərçivəsində müvafiq sübutlar təqdim edir.',
        'CDC Center təqdim edilmiş sübutlar əsasında yekun qərar vermək və escrow-da saxlanılan vəsaitlərin tərəflər arasında necə bölüşdürüləcəyini müəyyən etmək hüququnu özündə saxlayır. Bu qərar tərəflərdən heç birinin mübahisəni Gürcüstan qanunvericiliyinə uyğun olaraq məhkəmədə davam etdirmək hüququnu məhdudlaşdırmır.',
        'Pul çıxarma tələbləri platformanın daxili risk qiymətləndirmə prosesinə tabedir (zəruri hallarda PSD2/SCA-ya uyğun əlavə autentifikasiya daxil olmaqla, bax Bölmə 7) — yüksək riskli tələblər ödəniş prosesinin təhlükəsizliyini qorumaq üçün avtomatik təsdiq əvəzinə əl ilə inzibati baxışa yönləndirilir.',
      ],
    },
    {
      heading: '15. Məsuliyyətin Məhdudlaşdırılması',
      paragraphs: [
        'Platforma "olduğu kimi" təqdim olunur. CDC, qanunla tələb olunan hallar istisna olmaqla, freelancer bazarında istifadəçilər arasında bağlanan sövdələşmələrin nəticələrinə görə məsuliyyət daşımır.',
      ],
    },
    {
      heading: '16. Tətbiq Olunan Qanunvericilik',
      paragraphs: [
        'Bu şərtlər Gürcüstan qanunvericiliyi ilə tənzimlənir. Mübahisələr Gürcüstanın səlahiyyətli məhkəmələrinin baxışına aiddir.',
      ],
    },
    {
      heading: '17. Əlaqə',
      paragraphs: ['Digital Careers Center (CDC Georgia) (ID Kodu 438737743) · contact@cdc.org.ge · +995 551 14 14 11'],
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
