// Predefined skill taxonomy for the freelancer skill-verification system —
// mirrors Backend/src/data/freelancerSkills.ts (duplicated rather than
// shared — separate TS projects, no shared package layer in this repo).
// Not a closed set: the "Other" field lets a freelancer add any skill name
// not listed here, stored identically alongside predefined ones.
export interface FreelancerSkillDefinition {
  value: string;
  labelKa: string;
  labelEn: string;
  group: string;
}

import { SupportedLocale } from '../utils/locale';

const FREELANCER_SKILL_GROUPS_BASE: Record<string, { ka: string; en: string }> = {
  web: { ka: 'ვებ დეველოპმენტი', en: 'Web Development' },
  design: { ka: 'დიზაინი', en: 'Design' },
  marketing: { ka: 'მარკეტინგი', en: 'Marketing' },
  data: { ka: 'მონაცემები', en: 'Data' },
  media: { ka: 'ვიდეო და აუდიო', en: 'Video & Audio' },
  business: { ka: 'ბიზნესი და ადმინისტრირება', en: 'Business & Admin' },
};

// German/Spanish/French/Ukrainian labels haven't been translated yet — fall
// back to English rather than silently showing Georgian.
export const FREELANCER_SKILL_GROUPS: Record<string, Record<SupportedLocale, string>> = Object.fromEntries(
  Object.entries(FREELANCER_SKILL_GROUPS_BASE).map(([group, { ka, en }]) => [
    group,
    { ka, en, de: en, es: en, fr: en, uk: en },
  ])
);

export const FREELANCER_SKILLS: FreelancerSkillDefinition[] = [
  { value: 'React / Frontend Development', labelKa: 'React / ფრონტენდ დეველოპმენტი', labelEn: 'React / Frontend Development', group: 'web' },
  { value: 'WordPress', labelKa: 'WordPress', labelEn: 'WordPress', group: 'web' },
  { value: 'Backend Development / APIs', labelKa: 'ბექენდ დეველოპმენტი / APIs', labelEn: 'Backend Development / APIs', group: 'web' },
  { value: 'Mobile App Development', labelKa: 'მობილური აპლიკაციების დეველოპმენტი', labelEn: 'Mobile App Development', group: 'web' },
  { value: 'UI/UX Design', labelKa: 'UI/UX დიზაინი', labelEn: 'UI/UX Design', group: 'design' },
  { value: 'Graphic Design', labelKa: 'გრაფიკული დიზაინი', labelEn: 'Graphic Design', group: 'design' },
  { value: '3D & Blender Animation', labelKa: '3D & Blender ანიმაცია', labelEn: '3D & Blender Animation', group: 'design' },
  { value: 'Motion Graphics / Animation', labelKa: 'მოუშენ გრაფიკა / ანიმაცია', labelEn: 'Motion Graphics / Animation', group: 'design' },
  { value: 'SEO', labelKa: 'SEO', labelEn: 'SEO', group: 'marketing' },
  { value: 'Social Media Marketing', labelKa: 'სოციალური მედია მარკეტინგი', labelEn: 'Social Media Marketing', group: 'marketing' },
  { value: 'Copywriting', labelKa: 'კოპირაითინგი', labelEn: 'Copywriting', group: 'marketing' },
  { value: 'Email Marketing', labelKa: 'ელფოსტის მარკეტინგი', labelEn: 'Email Marketing', group: 'marketing' },
  { value: 'Excel / Google Sheets', labelKa: 'Excel / Google Sheets', labelEn: 'Excel / Google Sheets', group: 'data' },
  { value: 'Data Analysis', labelKa: 'მონაცემთა ანალიზი', labelEn: 'Data Analysis', group: 'data' },
  { value: 'Data Entry', labelKa: 'მონაცემთა შეყვანა', labelEn: 'Data Entry', group: 'data' },
  { value: 'Video Editing', labelKa: 'ვიდეო მონტაჟი', labelEn: 'Video Editing', group: 'media' },
  { value: 'Voiceover / Audio Production', labelKa: 'ხმის ჩაწერა / აუდიო პროდაქშენი', labelEn: 'Voiceover / Audio Production', group: 'media' },
  { value: 'Photography', labelKa: 'ფოტოგრაფია', labelEn: 'Photography', group: 'media' },
  { value: 'Virtual Assistance', labelKa: 'ვირტუალური ასისტენტობა', labelEn: 'Virtual Assistance', group: 'business' },
  { value: 'Bookkeeping / Accounting', labelKa: 'ბუღალტერია', labelEn: 'Bookkeeping / Accounting', group: 'business' },
  { value: 'Translation', labelKa: 'თარგმანი', labelEn: 'Translation', group: 'business' },
  { value: 'Customer Support', labelKa: 'მომხმარებელთა მხარდაჭერა', labelEn: 'Customer Support', group: 'business' },
];
