// Label dictionary for the admin Mentor Management section + profile editor
// (pages/admin/mentorship.tsx). Admin pages here don't go through next-i18next
// (no page-level getStaticProps/serverSideTranslations for the admin area), so
// this section uses the same lightweight inline-dictionary approach the
// globally-shared components keep (see utils/locale.ts's own comment) —
// KA/EN only, since the admin panel itself only operates in those two.
import { useAdminLang } from '../context/AdminLangContext';

type Dict = Record<string, { ka: string; en: string }>;

export const MENTOR_ADMIN_LABELS: Dict = {
  // Management section heading
  mentorsHeading: { ka: 'მენტორები', en: 'Mentors' },
  mentorsDescription: {
    ka: 'მართეთ მენტორების პროფილები, საჯარო სტატუსი და ინფორმაცია.',
    en: 'Manage mentor profiles, public visibility, and information.',
  },
  // Column-ish labels
  mentorColumn: { ka: 'მენტორი', en: 'Mentor' },
  skillsColumn: { ka: 'უნარები', en: 'Skills' },
  rateColumn: { ka: 'ტარიფი', en: 'Rate' },
  languagesColumn: { ka: 'ენები', en: 'Languages' },
  cvColumn: { ka: 'CV', en: 'CV' },
  statusColumn: { ka: 'სტატუსი', en: 'Status' },
  actionsColumn: { ka: 'მოქმედებები', en: 'Actions' },
  cvAttached: { ka: 'CV ატვირთულია', en: 'CV attached' },
  noCv: { ka: 'CV არ არის', en: 'No CV' },
  published: { ka: 'გამოქვეყნებული', en: 'Published' },
  draft: { ka: 'გამოუქვეყნებელი', en: 'Draft' },
  perHour: { ka: '/ სთ', en: '/ hr' },
  // Actions
  edit: { ka: 'რედაქტირება', en: 'Edit' },
  publish: { ka: 'გამოქვეყნება', en: 'Publish' },
  unpublish: { ka: 'გამოქვეყნების გაუქმება', en: 'Unpublish' },
  removeMentor: { ka: 'მენტორობიდან მოხსნა', en: 'Remove Mentor' },
  cancel: { ka: 'გაუქმება', en: 'Cancel' },
  // Remove confirmation
  removeConfirmTitle: {
    ka: 'ნამდვილად გსურთ ამ მომხმარებლის მენტორობიდან მოხსნა?',
    en: 'Are you sure you want to remove this user as a mentor?',
  },
  removeConfirmBody: {
    ka: 'მომხმარებლის ანგარიში არ წაიშლება, თუმცა ის აღარ გამოჩნდება მენტორების სიასა და საჯარო მენტორების გვერდზე.',
    en: 'The user account will not be deleted, but the user will no longer appear in the mentor management list or public mentor directory.',
  },
  removing: { ka: 'იხსნება…', en: 'Removing…' },
  // Editor (existing form labels, localized)
  availabilityHeading: { ka: 'მენტორის ხელმისაწვდომობა (Google Calendar დაჯავშნები)', en: 'Mentor Availability (Google Calendar bookings)' },
  availabilityHint: {
    ka: 'ყოველკვირეული განმეორებადი შუალედები (Asia/Tbilisi დრო), რომლებშიც მენტორის დაჯავშნა შესაძლებელია ფასიანი სესიისთვის.',
    en: "Recurring weekly slots (Asia/Tbilisi time) a mentor can be booked for a paid session.",
  },
  mentorLabel: { ka: 'მენტორი', en: 'Mentor' },
  visibilityLabel: { ka: 'საჯარო საქაღალდეში ჩვენება', en: 'Public directory visibility' },
  visibilityLive: { ka: 'ეს მენტორი ცოცხლად არის საჯარო /mentors გვერდზე.', en: 'This mentor is live on the public /mentors page.' },
  visibilityHidden: { ka: 'მალულია საჯარო /mentors გვერდიდან გამოქვეყნებამდე.', en: 'Hidden from the public /mentors page until published.' },
  avatarLabel: { ka: 'ავატარი / პროფილის ფოტო (PNG ან JPG)', en: 'Avatar / Profile Photo (PNG or JPG)' },
  uploading: { ka: 'იტვირთება…', en: 'Uploading…' },
  replacePhoto: { ka: 'ფოტოს შეცვლა', en: 'Replace Photo' },
  uploadPhoto: { ka: 'ფოტოს ატვირთვა', en: 'Upload Photo' },
  titleKa: { ka: 'თანამდებობა / პოზიცია (ქარ)', en: 'Title / Position (KA)' },
  titleEn: { ka: 'თანამდებობა / პოზიცია (ინგ)', en: 'Title / Position (EN)' },
  hourlyRate: { ka: 'საათობრივი ტარიფი (₾)', en: 'Hourly Rate (GEL / ₾)' },
  coreSkills: { ka: 'ძირითადი უნარები (მძიმით გამოყოფილი)', en: 'Core Skills (comma-separated)' },
  spokenLanguages: { ka: 'საუბრის ენები', en: 'Spoken Languages' },
  bioKa: { ka: 'ბიო (ქარ)', en: 'Bio (KA)' },
  bioEn: { ka: 'ბიო (ინგ)', en: 'Bio (EN)' },
  cvLabel: { ka: 'CV / რეზიუმე (PDF ან DOCX)', en: 'CV / Resume (PDF or DOCX)' },
  viewCurrentCv: { ka: 'მიმდინარე CV-ს ნახვა', en: 'View current CV' },
  uploadCv: { ka: 'CV-ს ატვირთვა', en: 'Upload CV' },
  replaceCv: { ka: 'CV-ს შეცვლა', en: 'Replace CV' },
  saveProfile: { ka: 'პროფილის შენახვა', en: 'Save Profile' },
  saving: { ka: 'ინახება…', en: 'Saving…' },
  saved: { ka: 'შენახულია.', en: 'Saved.' },
  autoTranslate: { ka: '✨ ავტომატური თარგმანი ინგლისურად', en: '✨ Auto-Translate to English' },
  translating: { ka: 'ითარგმნება…', en: 'Translating…' },
  // Errors / messages touched by this flow
  publishError: { ka: 'გამოქვეყნების სტატუსის შეცვლა ვერ მოხერხდა.', en: 'Could not update publish status.' },
  removeError: { ka: 'მენტორობიდან მოხსნა ვერ მოხერხდა. სცადეთ თავიდან.', en: 'Could not remove this mentor. Please try again.' },
  cvUploadFailed: { ka: 'CV-ს ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.', en: 'CV upload failed. Please try again.' },
  avatarUploadFailed: { ka: 'ფოტოს ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.', en: 'Avatar upload failed. Please try again.' },
  translateFailed: { ka: 'თარგმანი ვერ შესრულდა. სცადეთ ხელახლა.', en: 'Translation failed. Please try again.' },
  translateHint: { ka: 'შეავსეთ ქართული თანამდებობა და ბიო თარგმნამდე.', en: 'Fill in the Georgian Title and Bio before translating.' },
  loadFailed: { ka: 'მენტორების სიის ჩატვირთვა ვერ მოხერხდა.', en: 'Could not load the mentor list.' },
  loading: { ka: 'იტვირთება…', en: 'Loading…' },
  noMentors: { ka: 'მენტორები ჯერ არ არიან.', en: 'No mentors yet.' },
  notPublishedOption: { ka: '— გამოუქვეყნებელი', en: '— Not Published' },
  publishedOption: { ka: '— გამოქვეყნებული', en: '— Published' },
  // Defect 3 fix: a mentorLanguages value that isn't one of LANGUAGE_OPTIONS
  // (legacy data, or corruption like a pre-existing "???????" entry) still
  // needs to be visible and removable in the editor instead of silently
  // stuck forever — this labels that chip row generically, with no
  // reference to any specific value.
  unknownLanguagesLabel: {
    ka: 'სხვა შენახული მნიშვნელობები (დააჭირეთ წასაშლელად)',
    en: 'Other saved values (click to remove)',
  },
};

// Reads the SAME admin-panel language toggle every other admin page uses
// (AdminLangContext, driven by the KA/EN buttons in AdminLayout's header) —
// not router.locale/next-i18next, which the admin section doesn't use at all
// (see AdminLangContext's own comment). This previously read router.locale,
// which the admin KA/EN toggle never touches, so switching languages there
// changed the admin chrome but left this section stuck in Georgian.
export function useMentorAdminT(): (key: keyof typeof MENTOR_ADMIN_LABELS) => string {
  const { lang } = useAdminLang();
  return (key) => {
    const entry = MENTOR_ADMIN_LABELS[key];
    return entry ? entry[lang] : String(key);
  };
}
