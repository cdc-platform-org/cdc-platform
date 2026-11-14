/**
 * UI text for the AI coloring-page tool (pages/dashboard/tools/coloring-pages.tsx).
 * Georgian + English; other site locales fall back to English.
 */
import { resolveLocale } from '@/src/utils/locale';

const en = {
  title: 'AI Coloring Pages',
  subtitle: 'Type any topic and get a printable black-and-white coloring page in about a minute.',
  topicLabel: 'What should we draw?',
  topicPlaceholder: 'e.g. a dinosaur in space',
  examplesLabel: 'Ideas:',
  examples: ['A dinosaur in space', 'A cat playing guitar', 'A castle with a dragon', 'Children playing chess', 'An underwater city', 'A tractor on a farm'],
  generate: 'Draw it',
  generating: 'Drawing… this takes about a minute',
  freeChip: '1 free page',
  creditsChip: (n: number) => `${n} credit${n === 1 ? '' : 's'} left`,
  rules: 'For kids: adult content, hate, violence, weapons, drugs, real people and branded characters are not allowed. You only pay for pages you receive.',
  myPages: 'My coloring pages',
  empty: 'Your pages will appear here.',
  downloadPdf: 'PDF (A4)',
  downloadPng: 'PNG',
  delete: 'Delete',
  confirmDelete: 'Delete this page?',
  buyTitle: 'Buy credits',
  buySubtitle: '1 credit = 1 coloring page. Credits never expire.',
  pagesLabel: (n: number) => `${n} pages`,
  perPage: (gel: string) => `${gel} ₾ per page`,
  buy: 'Buy',
  redirecting: 'Opening payment…',
  errors: {
    BLOCKED: 'This topic is not allowed for children. Please choose another one.',
    NO_CREDITS: 'You have no credits left. Buy a pack below to continue.',
    RATE_LIMITED: 'You reached the hourly limit. Please try again later.',
    BUSY: 'Another page is still being drawn. Please wait.',
    INVALID_TOPIC: 'Please write a topic of 2–200 characters.',
    NOT_CONFIGURED: 'The tool is temporarily unavailable. Please try again later.',
    FAILED: 'Drawing failed. Your credit was not used — please try again.',
    GENERIC: 'Something went wrong. Please try again.',
    PAYMENT: 'Could not start the payment. Please try again.',
  },
  reasons: {
    SEXUAL: 'adult content',
    HATE: 'hate',
    VIOLENCE: 'violence',
    SELF_HARM: 'self-harm',
    DRUGS: 'drugs, alcohol or smoking',
    REAL_PERSON: 'a real person',
    COPYRIGHT: 'a branded or copyrighted character — try a similar original idea',
    OTHER: 'not suitable for children',
  } as Record<string, string>,
  reasonPrefix: 'Reason:',
};

const ka: typeof en = {
  title: 'AI გასაფერადებელი გვერდები',
  subtitle: 'ჩაწერეთ ნებისმიერი თემა და დაახლოებით ერთ წუთში მიიღებთ დასაბეჭდ შავ-თეთრ გასაფერადებელ გვერდს.',
  topicLabel: 'რა დავხატოთ?',
  topicPlaceholder: 'მაგ. დინოზავრი კოსმოსში',
  examplesLabel: 'იდეები:',
  examples: ['დინოზავრი კოსმოსში', 'კატა გიტარაზე უკრავს', 'ციხე-სიმაგრე და დრაკონი', 'ბავშვები ჭადრაკს თამაშობენ', 'წყალქვეშა ქალაქი', 'ტრაქტორი ფერმაში'],
  generate: 'დახატე',
  generating: 'იხატება… დაახლოებით ერთი წუთი',
  freeChip: '1 უფასო გვერდი',
  creditsChip: (n: number) => `დარჩენილია ${n} კრედიტი`,
  rules: 'ბავშვებისთვისაა: აკრძალულია 18+, სიძულვილი, ძალადობა, იარაღი, ნარკოტიკი, რეალური ადამიანები და ბრენდის პერსონაჟები. იხდით მხოლოდ მიღებულ გვერდებში.',
  myPages: 'ჩემი გასაფერადებელი გვერდები',
  empty: 'თქვენი გვერდები აქ გამოჩნდება.',
  downloadPdf: 'PDF (A4)',
  downloadPng: 'PNG',
  delete: 'წაშლა',
  confirmDelete: 'წავშალოთ ეს გვერდი?',
  buyTitle: 'კრედიტების ყიდვა',
  buySubtitle: '1 კრედიტი = 1 გასაფერადებელი გვერდი. კრედიტებს ვადა არ გასდით.',
  pagesLabel: (n: number) => `${n} გვერდი`,
  perPage: (gel: string) => `${gel} ₾ ერთი გვერდი`,
  buy: 'ყიდვა',
  redirecting: 'გადახდა იხსნება…',
  errors: {
    BLOCKED: 'ეს თემა ბავშვებისთვის დაშვებული არ არის. გთხოვთ, აირჩიოთ სხვა.',
    NO_CREDITS: 'კრედიტები ამოგეწურათ. გასაგრძელებლად იყიდეთ პაკეტი ქვემოთ.',
    RATE_LIMITED: 'საათის ლიმიტი ამოიწურა. სცადეთ ცოტა ხანში.',
    BUSY: 'წინა გვერდი ჯერ კიდევ იხატება. გთხოვთ, დაელოდოთ.',
    INVALID_TOPIC: 'გთხოვთ, ჩაწეროთ თემა 2–200 სიმბოლოთი.',
    NOT_CONFIGURED: 'ხელსაწყო დროებით მიუწვდომელია. სცადეთ მოგვიანებით.',
    FAILED: 'დახატვა ვერ მოხერხდა. კრედიტი არ დაგეხარჯათ, სცადეთ თავიდან.',
    GENERIC: 'რაღაც შეცდომა მოხდა. სცადეთ თავიდან.',
    PAYMENT: 'გადახდის დაწყება ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  reasons: {
    SEXUAL: '18+ შინაარსი',
    HATE: 'სიძულვილი',
    VIOLENCE: 'ძალადობა',
    SELF_HARM: 'თვითდაზიანება',
    DRUGS: 'ნარკოტიკი, ალკოჰოლი ან მოწევა',
    REAL_PERSON: 'რეალური ადამიანი',
    COPYRIGHT: 'ბრენდის ან საავტორო პერსონაჟი — სცადეთ მსგავსი საკუთარი იდეა',
    OTHER: 'ბავშვებისთვის შეუფერებელია',
  },
  reasonPrefix: 'მიზეზი:',
};

export type ColoringStrings = typeof en;

export function coloringStrings(locale: string | undefined): ColoringStrings {
  return resolveLocale(locale) === 'ka' ? ka : en;
}
