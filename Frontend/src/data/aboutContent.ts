// Central content source for the /about page (and reusable elsewhere) —
// deliberately kept as plain exported data rather than inline JSX, so the
// center's description/team/mission can be updated here directly without
// touching page layout code.

export interface AboutTeamMember {
  initials: string;
  name: { ka: string; en: string };
  role: { ka: string; en: string };
  bio: { ka: string; en: string };
}

export interface AboutStat {
  value: string;
  label: { ka: string; en: string };
}

export interface AboutFocusArea {
  ka: string;
  en: string;
}

export interface AboutAchievement {
  title: { ka: string; en: string };
  description: { ka: string; en: string };
}

export const aboutContent = {
  heading: {
    ka: 'ჩვენ შესახებ',
    en: 'About Us',
  },
  mission: {
    ka: 'CDC — ციფრული პროფესიების ცენტრი — არის ეკოსისტემა გურიაში, შექმნილი HEKS/EPER Georgia-ს მხარდაჭერით, პროექტის „სოციალური ინოვაციების პლატფორმა — ფაზა 2" ფარგლებში, 2023 წელს. ჩვენ ვაძლიერებთ ახალგაზრდებსა და ქალებს ციფრული წიგნიერების, ხელოვნური ინტელექტისა და კრეატიული ინდუსტრიების საშუალებით — პრაქტიკული, დასაქმებაზე ორიენტირებული განათლებით.',
    en: 'CDC — the Center for Digital Careers — is an ecosystem in Guria, established in 2023 with the support of HEKS/EPER Georgia, under the "Social Innovation Platform — Phase 2" project. We empower youth and women through digital literacy, artificial intelligence, and creative industries — with practical, employment-focused education.',
  },
  foundingProject: {
    ka: 'დაარსდა 2023 წელს, HEKS/EPER-ის მხარდაჭერით მიმდინარე პროექტის „სოციალური ინოვაციების პლატფორმა — ფაზა 2" ფარგლებში.',
    en: 'Founded in 2023 under the HEKS/EPER-supported project "Social Innovation Platform – Phase 2".',
  },
  physicalAddress: {
    ka: 'საქართველო, ქალაქი სამტრედია, თამარ მეფის ქ., N 8, ბინა N2',
    en: 'Tamar Mepe St. N8, Apt. N2, Samtredia, Georgia',
  },
  descriptionParagraphs: [
    {
      ka: 'ჩვენი მისიაა რეგიონული ტექნოლოგიური წინსვლა: ვასწავლით საერთაშორისო სტანდარტების სასწავლო მეთოდოლოგიით და ვუზრუნველყოფთ კურსდამთავრებულებს რეალურ პროექტებზე მუშაობის გამოცდილებით ჩვენივე ფრილანს/სამუშაო პლატფორმის საშუალებით.',
      en: 'Our mission is regional technological progress: we teach using international-standard methodology and equip graduates with real project experience through our own freelance/work marketplace platform.',
    },
    {
      ka: 'CDC Platform აერთიანებს ონლაინ სასწავლო კურსებს (LMS), ვერიფიცირებულ სერტიფიცირებას, ფრილანს ბირჟასა და ვაკანსიების დაფას — ერთიან ეკოსისტემაში, სადაც სწავლა პირდაპირ გადადის დასაქმებაში.',
      en: 'The CDC Platform brings together online courses (LMS), verified certification, a freelance marketplace, and a job board — one ecosystem where learning leads directly into employment.',
    },
  ],
  focusAreas: [
    { ka: 'ციფრული უნარების სწავლება', en: 'Digital skills training' },
    { ka: 'ახალგაზრდების კარიერული გაძლიერება', en: "Youth career empowerment" },
    { ka: 'ქალთა ეკონომიკური გაძლიერება', en: "Women's economic strengthening" },
    { ka: 'სოციალური მეწარმეობა', en: 'Social entrepreneurship' },
    { ka: 'სტარტაპების მხარდაჭერა', en: 'Startup support' },
    { ka: 'ციფრული სააგენტოს სერვისები', en: 'Digital agency services' },
  ] as AboutFocusArea[],
  stats: [
    { value: '200+', label: { ka: 'კურსდამთავრებული', en: 'Graduates' } },
    { value: '180+', label: { ka: 'ბენეფიციარი (2025)', en: 'Beneficiaries (2025)' } },
    { value: '100%', label: { ka: 'პრაქტიკული დავალებები', en: 'Practical Tasks' } },
    { value: '2023', label: { ka: 'დაარსების წელი', en: 'Founded' } },
  ] as AboutStat[],
  achievements: [
    {
      title: { ka: '180+ ბენეფიციარი გაწვრთნილია 2025 წელს', en: '180+ Beneficiaries Trained in 2025' },
      description: {
        ka: '180-ზე მეტი ბენეფიციარი, მათ შორის შშმ პირები, გაწვრთნილია ციფრულ პროფესიებში 2025 წლის განმავლობაში.',
        en: 'Over 180 beneficiaries, including persons with disabilities (PWDs), trained in digital professions during 2025.',
      },
    },
    {
      title: { ka: 'Taylor Georgia', en: 'Taylor Georgia' },
      description: {
        ka: 'სტარტაპის მხარდაჭერა ციფრული საკერავი ნაკეთობების პლატფორმისა და ვებ-გვერდისთვის.',
        en: 'Startup support for a digital sewing-patterns platform and web presence.',
      },
    },
    {
      title: { ka: '„ძლიერი ქალი = ძლიერი საზოგადოება"', en: '"Strong Woman = Strong Community"' },
      description: {
        ka: '60 ქალის გაწვრთნა გურიაში, ბულგარეთის საელჩოს მხარდაჭერით.',
        en: 'Training 60 women in Guria, with the support of the Embassy of Bulgaria.',
      },
    },
    {
      title: { ka: '„მწვანე გურია"', en: '"Green Guria"' },
      description: {
        ka: 'ტურისტული ვებ-პლატფორმისა და QR-კოდის პროექტის შექმნა გურიის რეგიონისთვის.',
        en: 'Tourism web platform and QR-code project built for the Guria region.',
      },
    },
    {
      title: { ka: 'Creative Motion: Code-to-Client', en: 'Creative Motion: Code-to-Client' },
      description: {
        ka: 'პარტნიორობა Technopark-თან პრაქტიკული, კლიენტზე ორიენტირებული ტრენინგისთვის.',
        en: 'Partnership with Technopark for hands-on, client-facing training.',
      },
    },
  ] as AboutAchievement[],
  team: [
    {
      initials: 'IT',
      name: { ka: 'ია თავდიშვილი', en: 'Ia Tavdishvili' },
      role: { ka: 'დირექტორი', en: 'Director' },
      bio: {
        ka: 'ციფრული პროფესიების ცენტრის სტრატეგიული მართვა, პარტნიორობები და განვითარება.',
        en: 'Strategic management, partnerships, and core center development.',
      },
    },
    {
      initials: 'MG',
      name: { ka: 'მარიკა გაგუა', en: 'Marika Gagua' },
      role: { ka: 'სასწავლო მიმართულებების კოორდინატორი', en: 'Academic Coordinator' },
      bio: {
        ka: 'სასწავლო პროცესების მართვა, სილაბუსების ოპტიმიზაცია და სტუდენტების მონიტორინგი.',
        en: 'Academic path coordination, syllabus optimization and student tracking.',
      },
    },
    {
      initials: 'IM',
      name: { ka: 'იმედო მარტიკოვი', en: 'Imedo Martikovi' },
      role: { ka: 'პროექტების მენეჯერი', en: 'Project Manager' },
      bio: {
        ka: 'პლატფორმის ციფრული ინფრასტრუქტურის, სააგენტოს და ინოვაციური პროექტების მართვა.',
        en: 'Digital infrastructure management, studio agency and innovation engineering.',
      },
    },
  ] as AboutTeamMember[],
};
