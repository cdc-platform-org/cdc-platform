// Refund Policy (ka + en). Keep in sync with terms.ts sections 13, 16, 18.
import { LegalSection } from '@/src/components/layout/LegalSections';
import { merchantInfo, entityLineKa, entityLineEn } from './shared';

const ka: LegalSection[] = [
  {
    heading: '1. ზოგადი პრინციპი: ციფრული პროდუქტი',
    paragraphs: [
      'CDC-ის კურსები, ციფრული პროდუქტები, AI სერვისები და საბავშვო წიგნები ციფრული, არამატერიალური პროდუქტია და მიეწოდება გადახდის დადასტურებისთანავე. საქართველოს კანონმდებლობის შესაბამისად, მომხმარებელი წინასწარ ეთანხმება, რომ დაუყოვნებელი მიწოდების შემდეგ გაუქმების სტანდარტული უფლება შეიძლება შეიზღუდოს ქვემოთ მოცემული პირობებით.',
    ],
  },
  {
    heading: '2. კურსები და ლაივ ტრენინგები',
    paragraphs: [
      'კურსის თანხა სრულად ბრუნდება შესყიდვიდან 24 საათში, თუ ნანახია კონტენტის 10%-ზე ნაკლები და სერტიფიკატი არ არის გაცემული. 24 საათის შემდეგ ან 10%-ზე მეტის ნახვისას თანხა არ ბრუნდება.',
      'ლაივ ტრენინგის თანხა ბრუნდება, თუ ტრენინგი გაუქმდა ან გადაიდო ჩვენი მიზეზით და ახალი თარიღი არ გაწყობთ.',
    ],
  },
  {
    heading: '3. ციფრული მაღაზია და დიზაინის რედაქტორი',
    paragraphs: [
      'ციფრული მაღაზიის პროდუქტები (შაბლონები, დიზაინის ფაილები, ციფრული ხელსაწყოები) მიეწოდება მყისიერად. პროდუქტის ჩამოტვირთვის ან რედაქტორში გახსნის შემდეგ თანხა არ ბრუნდება, გარდა იმ შემთხვევისა, როცა ფაილი დაზიანებულია ან არსებითად არ შეესაბამება აღწერას.',
    ],
  },
  {
    heading: '4. სასაჩუქრე ბარათები',
    paragraphs: [
      'სასაჩუქრე ბარათი არ იცვლება ნაღდ ფულზე და გადახდილი თანხა არ ბრუნდება. გამონაკლისია შემთხვევა, როცა ბარათი ან კოდი ტექნიკური ხარვეზის გამო ვერ მიიღეთ და პრობლემა გონივრულ ვადაში ვერ მოგვარდა.',
    ],
  },
  {
    heading: '5. საბავშვო წიგნები',
    paragraphs: [
      'წიგნი იქმნება ინდივიდუალურად თქვენი შეკვეთით, ამიტომ შექმნის შემდეგ თანხა არ ბრუნდება გემოვნების ან სტილის გამო. თუ წიგნი ტექნიკური ხარვეზით ვერ შეიქმნა ან არსებითად დაზიანებულია, თავიდან შევქმნით ან თანხას სრულად დაგიბრუნებთ.',
    ],
  },
  {
    heading: '6. AI გამოწერები (მაგ. IMIAKO PRO)',
    paragraphs: [
      'გამოწერის გაუქმება შესაძლებელია ნებისმიერ დროს; შემდეგი პერიოდის თანხა აღარ ჩამოიჭრება, ხოლო მიმდინარე, უკვე გადახდილი პერიოდი ბოლომდე მოქმედებს და მისი თანხა არ ბრუნდება. უფასო საცდელი პერიოდი ბარათს არ ჩამოჭრის.',
    ],
  },
  {
    heading: '7. ტექნიკური ხარვეზი',
    paragraphs: [
      'თუ შეძენილ სერვისზე წვდომა ვერ ხერხდება ჩვენი ტექნიკური ხარვეზის გამო და პრობლემა გონივრულ ვადაში არ მოგვარდება, თანხა ბრუნდება სრულად, ზემოთ მოცემული ვადების მიუხედავად.',
    ],
  },
  {
    heading: '8. ფრილანს ბირჟის გარიგებები',
    paragraphs: [
      'ესქროუ გარიგებები რეგულირდება ცალკე: თანხა თავისუფლდება დამკვეთის დადასტურებით ან დავის შემთხვევაში პლატფორმის დავების პროცედურით (იხ. წესები და პირობები, 21-ე პუნქტი).',
    ],
  },
  {
    heading: '9. მენტორობის სესიები',
    paragraphs: [
      'უფასო გაუქმება შესაძლებელია სესიამდე მინიმუმ 12 საათით ადრე, საბანკო ხარჯის გამოკლებით (იხ. მე-10 პუნქტი). 12 საათზე ნაკლებით ადრე გაუქმებისას ბრუნდება 50%. თუ მენტორი არ გამოცხადდა, ბრუნდება 100%.',
    ],
  },
  {
    heading: '10. საბანკო ხარჯი და ვალუტა',
    paragraphs: [
      'ნებაყოფლობითი მოთხოვნით დაბრუნებისას იქვითება თავდაპირველი გადახდის საბანკო ხარჯი (დაახლოებით 1.5%–2%). თანხა ბრუნდება იმავე ვალუტაში და იმავე ბარათზე, რომლითაც გადაიხადეთ (BOG-ით ლარში, Stripe-ით დოლარში). ვალუტის კურსის ცვლილებით ან თქვენი ბანკის საკომისიოთი გამოწვეულ სხვაობაზე CDC პასუხს არ აგებს.',
    ],
  },
  {
    heading: '11. დაბრუნების მოთხოვნის პროცედურა',
    paragraphs: [
      `დაბრუნების მოსათხოვად მოგვწერეთ: ${merchantInfo.email}, მიუთითეთ შესყიდვის თარიღი და პროდუქტის/სერვისის დასახელება. მოთხოვნას განვიხილავთ 5 სამუშაო დღეში; დამტკიცების შემთხვევაში თანხა ბრუნდება იმავე გადახდის მეთოდზე 14 კალენდარულ დღემდე ვადაში.`,
    ],
  },
  {
    heading: '12. კონტაქტი',
    paragraphs: [`${entityLineKa} · ${merchantInfo.email} · ${merchantInfo.phone}`],
  },
];

const en: LegalSection[] = [
  {
    heading: '1. General Principle: Digital Products',
    paragraphs: [
      "CDC courses, digital products, AI services and children's books are digital, non-tangible products delivered as soon as payment is confirmed. In line with Georgian law, the user agrees in advance that once delivery has started, the standard right of withdrawal may be limited under the terms below.",
    ],
  },
  {
    heading: '2. Courses and Live Trainings',
    paragraphs: [
      'A course is fully refundable within 24 hours of purchase if less than 10% of the content has been watched and no certificate has been issued. After 24 hours, or once 10% or more has been watched, it is non-refundable.',
      "A live training is refunded if it is cancelled or postponed for reasons on our side and the new date doesn't suit you.",
    ],
  },
  {
    heading: '3. Digital Store and Design Editor',
    paragraphs: [
      'Digital Store products (templates, design files, digital tools) are delivered instantly. Once a product has been downloaded or opened in the editor it is non-refundable, unless the file is broken or materially different from its description.',
    ],
  },
  {
    heading: '4. Gift Cards',
    paragraphs: [
      'Gift cards cannot be exchanged for cash and are non-refundable. The exception is when the card or code was not received because of a technical fault that we could not fix within a reasonable time.',
    ],
  },
  {
    heading: "5. Children's Books",
    paragraphs: [
      'Each book is created individually to your order, so it is not refundable for reasons of taste or style once created. If a book could not be created because of a technical fault, or is materially broken, we will regenerate it or give you a full refund.',
    ],
  },
  {
    heading: '6. AI Subscriptions (e.g. IMIAKO PRO)',
    paragraphs: [
      'You can cancel at any time; the next period will not be charged, while the current, already-paid period stays active until it ends and is not refunded. A free trial does not charge your card.',
    ],
  },
  {
    heading: '7. Technical Failure',
    paragraphs: [
      'If you cannot access a purchased service because of a technical fault on our side and it is not resolved within a reasonable time, you receive a full refund regardless of the timeframes above.',
    ],
  },
  {
    heading: '8. Freelance Marketplace Deals',
    paragraphs: [
      "Escrow deals are governed separately: funds are released on the client's approval or, in a dispute, through the platform's dispute process (see Terms & Conditions, Section 21).",
    ],
  },
  {
    heading: '9. Mentorship Sessions',
    paragraphs: [
      'Free cancellation up to 12 hours before the session, minus the bank cost (see Section 10). Cancelling less than 12 hours before refunds 50%. If the mentor does not show up, 100% is refunded.',
    ],
  },
  {
    heading: '10. Bank Costs and Currency',
    paragraphs: [
      'For a voluntary refund request, the bank cost of the original payment (about 1.5%–2%) is deducted. Funds are returned in the same currency to the card you paid with (GEL via BOG, USD via Stripe). CDC is not responsible for differences caused by exchange-rate changes or by your bank\'s fees.',
    ],
  },
  {
    heading: '11. How to Request a Refund',
    paragraphs: [
      `Email us at ${merchantInfo.email} with your purchase date and the product/service name. Requests are reviewed within 5 business days; if approved, funds are returned to the original payment method within up to 14 calendar days.`,
    ],
  },
  {
    heading: '12. Contact',
    paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
  },
];

export const refundPolicy = { ka, en };
