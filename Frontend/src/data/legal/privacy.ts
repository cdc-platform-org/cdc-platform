// Privacy Policy (ka + en). The processor list must match the services the
// backend really calls (payments: BOG, Stripe; AI: Google Gemini, Microsoft
// Azure OpenAI; email: Resend; video: Bunny.net; storage/hosting: Azure).
import { LegalSection } from '@/src/components/layout/LegalSections';
import { merchantInfo, entityLineKa, entityLineEn } from './shared';

const ka: LegalSection[] = [
  {
    heading: '1. შესავალი',
    paragraphs: [
      `წინამდებარე პოლიტიკა განსაზღვრავს, როგორ აგროვებს, იყენებს და იცავს ${entityLineKa} („CDC“, „ჩვენ“) პლატფორმის (cdc.org.ge) მომხმარებელთა პერსონალურ მონაცემებს, საქართველოს კანონმდებლობის (მათ შორის „პერსონალურ მონაცემთა დაცვის შესახებ“ კანონის) შესაბამისად.`,
    ],
  },
  {
    heading: '2. რა მონაცემებს ვაგროვებთ',
    paragraphs: [
      'ანგარიში: სახელი, ელ-ფოსტა, ტელეფონი, პაროლი (დაშიფრული სახით).',
      'ვერიფიკაცია (თუ გაივლით): პირადობის მოწმობის/პასპორტის ან საჯარო რეესტრის ამონაწერის ასლი, პირადი ნომერი ან საიდენტიფიკაციო კოდი.',
      'სწავლა და გამოცდები: ჩარიცხვები, პროგრესი, სერტიფიკატები, ტესტის შედეგები. AI ზედამხედველობის დროს კამერისა და მიკროფონის ნაკადი მუშავდება თქვენს მოწყობილობაზე; ჩვენ ვინახავთ მხოლოდ დარღვევის ტიპსა და დროს, ვიდეოსა და აუდიოს არა.',
      'AI ხელსაწყოები: თქვენ მიერ შეყვანილი ტექსტი, ატვირთული ფაილები და მიღებული პასუხები, სერვისის მიწოდებისა და ხარისხის კონტროლისთვის.',
      'საბავშვო წიგნები: ბავშვის სახელი, ასაკი, ფოტო და სხვა დეტალები, რომლებსაც მშობელი ან კანონიერი წარმომადგენელი ატვირთავს.',
      'დიზაინის რედაქტორი: თქვენი დიზაინები და მათში ატვირთული ფოტოები/ლოგოები.',
      'გადახდები: ტრანზაქციების ისტორია და ინვოისის მონაცემები. ბარათის მონაცემებს ჩვენ არ ვინახავთ.',
      'ვაკანსიები და ბირჟა: CV, განაცხადები, წინადადებები, შეტყობინებები, ფორუმის პოსტები.',
      'ტექნიკური: IP მისამართი, ბრაუზერი, შესვლის ისტორია, უსაფრთხოების ჟურნალი; ბრაუზერის აუცილებელი ქუქი-ფაილები და ლოკალური მეხსიერება შესვლისა და პარამეტრების (ენა, გადახდის მეთოდი) დასამახსოვრებლად.',
    ],
  },
  {
    heading: '3. მონაცემთა გამოყენების მიზნები',
    paragraphs: [
      'სერვისების მიწოდება: კურსები, გამოცდები, AI ხელსაწყოები, წიგნები, მაღაზია, ბირჟა, ვაკანსიები, მენტორობა.',
      'ანგარიშის ვერიფიკაცია, თაღლითობის პრევენცია და ერთი პირი = ერთი ანგარიშის წესის დაცვა.',
      'გადახდების, ინვოისების, თანხის დაბრუნებისა და გატანის დამუშავება.',
      'ანგარიშთან დაკავშირებული შეტყობინებები (ელ-ფოსტის დადასტურება, გადახდის სტატუსი, სასაჩუქრე ბარათის მიწოდება).',
      'უსაფრთხოებისა და ხარისხის გაუმჯობესება. თქვენს პირად მონაცემებს რეკლამისთვის არ ვყიდით.',
    ],
  },
  {
    heading: '4. მესამე მხარე პროვაიდერები',
    paragraphs: [
      'მონაცემებს ამუშავებენ მხოლოდ სანდო პროვაიდერები ჩვენი დავალებით: საქართველოს ბანკი და Stripe (გადახდები), Google Gemini და Microsoft Azure OpenAI (AI ხელსაწყოები, გამოცდის კითხვები, საბავშვო წიგნების ტექსტი/ილუსტრაცია/გახმოვანება), Microsoft Azure (ჰოსტინგი და ფაილების დახურული შენახვა), Bunny.net (ვიდეო), Resend (ელ-ფოსტა).',
      'ზოგიერთი პროვაიდერი მონაცემებს საქართველოს ფარგლებს გარეთ (მაგ. ევროკავშირში ან აშშ-ში) ამუშავებს, შესაბამისი დაცვის გარანტიებით. ვაკანსიაზე განაცხადი ეგზავნება მხოლოდ შესაბამის დამსაქმებელს.',
    ],
  },
  {
    heading: '5. ბავშვების მონაცემები',
    paragraphs: [
      'ბავშვის მონაცემებს (ფოტო, სახელი, დეტალები) ატვირთავს მხოლოდ მშობელი ან კანონიერი წარმომადგენელი და ისინი გამოიყენება მხოლოდ შეკვეთილი წიგნის შესაქმნელად. ბავშვის ფოტოს წაშლა შესაძლებელია ნებისმიერ დროს წიგნის გვერდიდან ან ჩვენთან დაკავშირებით.',
    ],
  },
  {
    heading: '6. შენახვის ვადა და უსაფრთხოება',
    paragraphs: [
      'ვერიფიკაციის დოკუმენტები და შეძენილი ფაილები ინახება დახურულ საცავში და მიიღება მხოლოდ მოკლევადიანი, დაცული ბმულით.',
      'ანგარიშის წაშლის მოთხოვნისას ანგარიში დაუყოვნებლივ დეაქტივირდება. 60 დღის განმავლობაში მისი აღდგენა შესაძლებელია, რის შემდეგაც მონაცემები იშლება ან ანონიმიზდება, თუ ისინი უკავშირდება სხვა მომხმარებლის ფინანსურ ჩანაწერებს. ბუღალტრული ჩანაწერები (ინვოისები) ინახება კანონით დადგენილი ვადით.',
    ],
  },
  {
    heading: '7. თქვენი უფლებები',
    paragraphs: [
      `შეგიძლიათ მოითხოვოთ თქვენი მონაცემების ასლი, შესწორება, წაშლა, დამუშავების შეზღუდვა ან თანხმობის გამოხმობა. მოთხოვნისთვის მოგვწერეთ: ${merchantInfo.email}. ასევე გაქვთ უფლება მიმართოთ საქართველოს პერსონალურ მონაცემთა დაცვის სამსახურს.`,
    ],
  },
  {
    heading: '8. კონტაქტი',
    paragraphs: [entityLineKa, `ელ-ფოსტა: ${merchantInfo.email} · ტელეფონი: ${merchantInfo.phone}`],
  },
];

const en: LegalSection[] = [
  {
    heading: '1. Introduction',
    paragraphs: [
      `This Privacy Policy explains how ${entityLineEn} ("CDC", "we") collects, uses and protects the personal data of users of the platform (cdc.org.ge), in accordance with Georgian law (including the Law on Personal Data Protection).`,
    ],
  },
  {
    heading: '2. What Data We Collect',
    paragraphs: [
      'Account: name, email, phone number, password (stored encrypted).',
      'Verification (if you choose it): a copy of your ID card/passport or Public Registry extract, your personal ID number or company ID code.',
      'Learning and exams: enrollments, progress, certificates, test results. During AI proctoring, the camera and microphone stream is processed on your device; we store only the type and time of flagged events, never the video or audio.',
      'AI tools: the text you enter, files you upload and the responses you receive, to provide the service and for quality control.',
      "Children's books: the child's name, age, photo and other details uploaded by a parent or legal guardian.",
      'Design editor: your designs and the photos/logos you upload into them.',
      'Payments: transaction history and invoice details. We never store card details.',
      'Job board and marketplace: CVs, applications, proposals, messages, forum posts.',
      'Technical: IP address, browser, login history, security logs; essential browser cookies and local storage to keep you signed in and remember preferences (language, payment method).',
    ],
  },
  {
    heading: '3. Purposes of Use',
    paragraphs: [
      "Providing the services: courses, exams, AI tools, books, store, marketplace, job board, mentorship.",
      'Account verification, fraud prevention and enforcing the one-person-one-account rule.',
      'Processing payments, invoices, refunds and payouts.',
      'Account-related notifications (email verification, payment status, gift-card delivery).',
      'Improving security and quality. We never sell your personal data for advertising.',
    ],
  },
  {
    heading: '4. Third-Party Providers',
    paragraphs: [
      "Data is processed only by trusted providers acting on our behalf: Bank of Georgia and Stripe (payments), Google Gemini and Microsoft Azure OpenAI (AI tools, exam questions, children's book text/illustrations/narration), Microsoft Azure (hosting and private file storage), Bunny.net (video), Resend (email).",
      'Some providers process data outside Georgia (e.g. in the EU or the US) with appropriate safeguards. A job application is sent only to the employer concerned.',
    ],
  },
  {
    heading: "5. Children's Data",
    paragraphs: [
      "A child's data (photo, name, details) is uploaded only by a parent or legal guardian and is used only to create the ordered book. The child's photo can be deleted at any time from the book page or by contacting us.",
    ],
  },
  {
    heading: '6. Retention and Security',
    paragraphs: [
      'Verification documents and purchased files are kept in private storage and are accessed only through short-lived, protected links.',
      "When you request account deletion, the account is deactivated immediately. It can be restored within 60 days, after which the data is deleted, or anonymized if linked to another user's financial records. Accounting records (invoices) are kept for the period required by law.",
    ],
  },
  {
    heading: '7. Your Rights',
    paragraphs: [
      `You can request a copy of your data, its correction or deletion, a restriction on processing, or withdraw your consent. Email ${merchantInfo.email}. You also have the right to complain to Georgia's Personal Data Protection Service.`,
    ],
  },
  {
    heading: '8. Contact',
    paragraphs: [entityLineEn, `Email: ${merchantInfo.email} · Phone: ${merchantInfo.phone}`],
  },
];

export const privacyPolicy = { ka, en };
