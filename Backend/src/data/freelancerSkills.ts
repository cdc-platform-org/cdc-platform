// Predefined skill taxonomy for the freelancer skill-verification system
// (skill selection at registration/profile, per-skill AI test generation,
// course-to-skill auto-verification). A freelancer isn't limited to this
// list — User.freelancerSkills is a plain string array, and any value typed
// into the "Other" field on the frontend is stored the same way as a
// predefined one. This list is only the curated suggestion set shown in the
// picker UI and the source of AI question-generation context for anything
// that matches one of these values.
//
// Keep in sync with Frontend/src/data/freelancerSkills.ts — duplicated
// rather than shared because Backend/Frontend are separate TS projects with
// no shared package layer in this repo.
export interface FreelancerSkillDefinition {
  value: string;
  labelKa: string;
  labelEn: string;
  group: string;
}

export const FREELANCER_SKILL_GROUPS: Record<string, { ka: string; en: string }> = {
  web: { ka: 'ვებ დეველოპმენტი', en: 'Web Development' },
  design: { ka: 'დიზაინი', en: 'Design' },
  marketing: { ka: 'მარკეტინგი', en: 'Marketing' },
  data: { ka: 'მონაცემები', en: 'Data' },
  media: { ka: 'ვიდეო და აუდიო', en: 'Video & Audio' },
  business: { ka: 'ბიზნესი და ადმინისტრირება', en: 'Business & Admin' },
};

export const FREELANCER_SKILLS: FreelancerSkillDefinition[] = [
  // Web Development
  { value: 'React / Frontend Development', labelKa: 'React / ფრონტენდ დეველოპმენტი', labelEn: 'React / Frontend Development', group: 'web' },
  { value: 'WordPress', labelKa: 'WordPress', labelEn: 'WordPress', group: 'web' },
  { value: 'Backend Development / APIs', labelKa: 'ბექენდ დეველოპმენტი / APIs', labelEn: 'Backend Development / APIs', group: 'web' },
  { value: 'Mobile App Development', labelKa: 'მობილური აპლიკაციების დეველოპმენტი', labelEn: 'Mobile App Development', group: 'web' },
  // Design
  { value: 'UI/UX Design', labelKa: 'UI/UX დიზაინი', labelEn: 'UI/UX Design', group: 'design' },
  { value: 'Graphic Design', labelKa: 'გრაფიკული დიზაინი', labelEn: 'Graphic Design', group: 'design' },
  { value: '3D & Blender Animation', labelKa: '3D & Blender ანიმაცია', labelEn: '3D & Blender Animation', group: 'design' },
  { value: 'Motion Graphics / Animation', labelKa: 'მოუშენ გრაფიკა / ანიმაცია', labelEn: 'Motion Graphics / Animation', group: 'design' },
  // Marketing
  { value: 'SEO', labelKa: 'SEO', labelEn: 'SEO', group: 'marketing' },
  { value: 'Social Media Marketing', labelKa: 'სოციალური მედია მარკეტინგი', labelEn: 'Social Media Marketing', group: 'marketing' },
  { value: 'Copywriting', labelKa: 'კოპირაითინგი', labelEn: 'Copywriting', group: 'marketing' },
  { value: 'Email Marketing', labelKa: 'ელფოსტის მარკეტინგი', labelEn: 'Email Marketing', group: 'marketing' },
  // Data
  { value: 'Excel / Google Sheets', labelKa: 'Excel / Google Sheets', labelEn: 'Excel / Google Sheets', group: 'data' },
  { value: 'Data Analysis', labelKa: 'მონაცემთა ანალიზი', labelEn: 'Data Analysis', group: 'data' },
  { value: 'Data Entry', labelKa: 'მონაცემთა შეყვანა', labelEn: 'Data Entry', group: 'data' },
  // Video & Audio
  { value: 'Video Editing', labelKa: 'ვიდეო მონტაჟი', labelEn: 'Video Editing', group: 'media' },
  { value: 'Voiceover / Audio Production', labelKa: 'ხმის ჩაწერა / აუდიო პროდაქშენი', labelEn: 'Voiceover / Audio Production', group: 'media' },
  { value: 'Photography', labelKa: 'ფოტოგრაფია', labelEn: 'Photography', group: 'media' },
  // Business & Admin
  { value: 'Virtual Assistance', labelKa: 'ვირტუალური ასისტენტობა', labelEn: 'Virtual Assistance', group: 'business' },
  { value: 'Bookkeeping / Accounting', labelKa: 'ბუღალტერია', labelEn: 'Bookkeeping / Accounting', group: 'business' },
  { value: 'Translation', labelKa: 'თარგმანი', labelEn: 'Translation', group: 'business' },
  { value: 'Customer Support', labelKa: 'მომხმარებელთა მხარდაჭერა', labelEn: 'Customer Support', group: 'business' },
];

const KNOWN_SKILL_VALUES = new Set(FREELANCER_SKILLS.map((s) => s.value));
export function isPredefinedSkill(value: string): boolean {
  return KNOWN_SKILL_VALUES.has(value);
}
