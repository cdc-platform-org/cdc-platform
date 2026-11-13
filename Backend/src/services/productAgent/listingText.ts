/**
 * Product agent — builds the KA/EN listing description in the same section
 * layout as the admin's own hand-written wall-print listing.
 * Exports: ListingSections, composeDescription, AI_CREDIT_KA, AI_CREDIT_EN.
 *
 * The AI writes only the variable parts (intro, what's inside, how to use);
 * the delivery notice, licence wording and copyright line are fixed text
 * here so every listing states them identically and correctly.
 */

export interface ListingSections {
  intro: string;
  // "Label — value" lines, e.g. "ფორმატი — PDF".
  receive: string[];
  // How to download / print / edit, one step per line.
  use: string[];
  license: 'PERSONAL_USE' | 'COMMERCIAL_USE';
  // Category-specific extra note (e.g. "check answers with a teacher").
  note?: string;
}

// Honest authorship line: the admin's own prints credit a human artist, so
// AI-made listings must not imply one. Editable on the draft.
export const AI_CREDIT_KA = 'შექმნილია CDC Studio-ს მიერ, ციფრული ინსტრუმენტებისა და ხელოვნური ინტელექტის დახმარებით.';
export const AI_CREDIT_EN = 'Created by CDC Studio with the help of digital tools and artificial intelligence.';

const TEXT = {
  ka: {
    receive: 'რას მიიღებთ',
    use: 'ჩამოტვირთვა და გამოყენება',
    author: 'ავტორი და გამოყენების პირობები',
    digital: 'ციფრული ჩამოტვირთვა. შეძენის შემდეგ მიიღებთ ჩამოტვირთვის ბმულს. ფიზიკური ნივთი არ გამოიგზავნება.',
    PERSONAL_USE:
      'ლიცენზია გაძლევთ ფაილების პირადი გამოყენებისა და დაბეჭდვის უფლებას. ფაილების გაზიარება, გავრცელება, გაყიდვა, გადაყიდვა ან სხვა კომერციული გამოყენება დაუშვებელია.',
    COMMERCIAL_USE:
      'ლიცენზია გაძლევთ შაბლონის თქვენი საკუთარი ბიზნესისთვის (მათ შორის კომერციული მიზნით) გამოყენების უფლებას. თავად შაბლონის ფაილების გაზიარება, გაყიდვა ან გადაყიდვა დაუშვებელია.',
    copyright: '© CDC Studio. ყველა უფლება დაცულია.',
    contact: 'დამატებითი კითხვების შემთხვევაში დაგვიკავშირდით.',
  },
  en: {
    receive: 'What You’ll Receive',
    use: 'Downloading and Using',
    author: 'Author and Usage Terms',
    digital: 'Digital download. After purchase, you will receive a download link. No physical item will be shipped.',
    PERSONAL_USE:
      'The license grants you the right to use and print the files for personal use. Sharing, distributing, selling, reselling, or any other commercial use of the files is prohibited.',
    COMMERCIAL_USE:
      'The license grants you the right to use the template for your own business, including commercial purposes. Sharing, selling or reselling the template files themselves is prohibited.',
    copyright: '© CDC Studio. All rights reserved.',
    contact: 'For additional questions, feel free to contact us.',
  },
};

export function composeDescription(lang: 'ka' | 'en', s: ListingSections): string {
  const t = TEXT[lang];
  const parts = [
    s.intro.trim(),
    t.receive,
    ...s.receive.map((l) => l.trim()),
    t.digital,
    t.use,
    ...s.use.map((l) => l.trim()),
    ...(s.note ? [s.note.trim()] : []),
    t.author,
    lang === 'ka' ? AI_CREDIT_KA : AI_CREDIT_EN,
    t[s.license],
    t.copyright,
    t.contact,
  ];
  return parts.filter(Boolean).join('\n\n').slice(0, 5000);
}
