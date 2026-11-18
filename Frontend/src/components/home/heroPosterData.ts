/**
 * Content of the 12 rotating hero "posters" (home page). Source: the user's
 * strategic plan "CDC პლატფორმის ციფრული პროფესიების სრული სტრატეგიული გეგმა"
 * — course names, who teaches (100% AI teacher / human lecturer + 24/7 AI
 * mentor / human lecturer + AI case simulator) and the studios named there
 * (browser Python studio, in-browser SQL database, 2-in-1 design editor).
 * Prices are deliberately not shown. The visual snippets inside each poster
 * are illustrative UI, not claims about outcomes.
 */
export type Lang = 'ka' | 'en';
export type Group = 'ai' | 'hybrid' | 'mentor';
export type Kind = 'python' | 'sql' | 'chat' | 'html' | 'sheet' | 'brand' | 'uiux' | 'react' | 'ads' | 'board' | 'product' | 'freelance';

export interface Poster {
  id: number;
  group: Group;
  kind: Kind;
  title: Record<Lang, string>;
  /** Small label on the window's right side (only studios the plan names). */
  studio?: string;
}

export const POSTERS: Poster[] = [
  { id: 1, group: 'ai', kind: 'python', studio: 'Python Studio', title: { ka: 'Python პროგრამირება 0-დან', en: 'Python programming from zero' } },
  { id: 2, group: 'ai', kind: 'sql', studio: 'SQL Studio', title: { ka: 'SQL და მონაცემთა ბაზები', en: 'SQL and databases' } },
  { id: 3, group: 'ai', kind: 'chat', title: { ka: 'Prompt Engineering & AI ავტომატიზაცია', en: 'Prompt Engineering & AI automation' } },
  { id: 4, group: 'ai', kind: 'html', title: { ka: 'Frontend საფუძვლები (HTML/CSS/JS)', en: 'Frontend basics (HTML/CSS/JS)' } },
  { id: 5, group: 'ai', kind: 'sheet', title: { ka: 'Excel & ბიზნეს ანალიტიკა', en: 'Excel & business analytics' } },
  { id: 6, group: 'ai', kind: 'brand', title: { ka: 'გრაფიკული დიზაინი (Branding & Visual)', en: 'Graphic design (Branding & Visual)' } },
  { id: 7, group: 'hybrid', kind: 'uiux', studio: 'Design Editor 2-in-1', title: { ka: 'UI/UX დიზაინი და პროტოტიპირება', en: 'UI/UX design and prototyping' } },
  { id: 8, group: 'hybrid', kind: 'react', title: { ka: 'Full-Stack ვებ-დეველოპმენტი (React/Node)', en: 'Full-Stack web development (React/Node)' } },
  { id: 9, group: 'hybrid', kind: 'ads', title: { ka: 'ციფრული მარკეტინგი (Meta & Google Ads)', en: 'Digital marketing (Meta & Google Ads)' } },
  { id: 10, group: 'mentor', kind: 'board', title: { ka: 'IT პროექტების მართვა (Agile/Scrum)', en: 'IT project management (Agile/Scrum)' } },
  { id: 11, group: 'mentor', kind: 'product', title: { ka: 'პროდუქტის მენეჯმენტი (Product Management)', en: 'Product Management' } },
  { id: 12, group: 'mentor', kind: 'freelance', title: { ka: 'ფრილანსინგი და საერთაშორისო გაყიდვები (Upwork/Fiverr)', en: 'Freelancing and international sales (Upwork/Fiverr)' } },
];

export const GROUP_COPY: Record<Group, { tag: Record<Lang, string>; teacher: Record<Lang, string> }> = {
  ai: {
    tag: { ka: '100% AI მასწავლებელი', en: '100% AI teacher' },
    teacher: { ka: 'ასწავლის: CDC AI მასწავლებელი', en: 'Taught by: CDC AI teacher' },
  },
  hybrid: {
    tag: { ka: 'ჰიბრიდული კურსი', en: 'Hybrid course' },
    teacher: { ka: 'ადამიანი-ლექტორი + 24/7 AI მენტორი', en: 'Human lecturer + 24/7 AI mentor' },
  },
  mentor: {
    tag: { ka: 'მენტორული კურსი', en: 'Mentoring course' },
    teacher: { ka: 'ადამიანი-ლექტორი + AI ქეის-სიმულატორი', en: 'Human lecturer + AI case simulator' },
  },
};

/** The Python poster names its teacher explicitly in the plan. */
export const PYTHON_TEACHER: Record<Lang, string> = {
  ka: 'CDC AI Python Mentor · სოკრატული მეთოდი',
  en: 'CDC AI Python Mentor · Socratic method',
};
