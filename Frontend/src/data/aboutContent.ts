// Central content source for the /about page (and reusable elsewhere) —
// deliberately kept as plain exported data rather than inline JSX, so the
// center's description/team/mission can be updated here directly without
// touching page layout code.

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

export interface MissionPillar {
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
  grantAnnouncement: {
    text: {
      ka: 'ცენტრი დაფუძნდა სოციალური ინოვაციების პლატფორმის (Social Innovation Georgia) გამარჯვებული პროექტის ფარგლებში.',
      en: 'The center was established within the winning project of Social Innovation Georgia.',
    },
    linkLabel: {
      ka: 'იხილეთ ვრცლად',
      en: 'Read Announcement',
    },
    url: 'https://www.facebook.com/share/v/1C3y6w2BKM/',
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
  // Mission & Values section — distinct from `mission` above (that's the
  // org's founding/history blurb; this is the actual mission STATEMENT +
  // the four pillars it's built on + why it matters to a business partner).
  missionValues: {
    heading: {
      ka: 'ციფრული პროფესიების ცენტრის (CDC) მისია',
      en: 'The Mission of the Center for Digital Careers (CDC)',
    },
    statement: {
      ka: 'შევქმნათ ხელმისაწვდომი, თანამედროვე და ავტომატიზებული ეკოსისტემა, რომელიც ნებისმიერ მსურველს აძლევს მოთხოვნადი ციფრული პროფესიებისა და თანამედროვე ციფრული ინსტრუმენტების ათვისების, პრაქტიკული უნარების განვითარებისა და დასაქმების რეალურ შესაძლებლობას.',
      en: 'To build an accessible, modern, and automated ecosystem that gives anyone who wants it a real opportunity to master in-demand digital professions and modern digital tools, develop practical skills, and find employment.',
    },
    pillars: [
      {
        title: { ka: 'ხელმისაწვდომობა და გაძლიერება', en: 'Accessibility & Empowerment' },
        description: {
          ka: 'რეგიონებში მცხოვრები ახალგაზრდებისა და ქალების ციფრული წიგნიერების გაზრდა და პროფესიული ხელშეწყობა.',
          en: 'Increasing digital literacy and providing professional support for young people and women living in the regions.',
        },
      },
      {
        title: { ka: 'ადაპტირებადი სასწავლო პროცესი', en: 'Adaptive Learning Process' },
        description: {
          ka: 'მოქნილი, ინდივიდუალურ საჭიროებებზე მორგებული სწავლება AI ასისტენტების, Google Classroom-ის, Live შეხვედრებისა და პრაქტიკული დავალებების ინტეგრაციით.',
          en: 'Flexible, individually-tailored learning through the integration of AI assistants, Google Classroom, live sessions, and practical assignments.',
        },
      },
      {
        title: { ka: 'მრავალენოვანი ეკოსისტემა', en: 'Multilingual Ecosystem' },
        description: {
          ka: 'ქართულენოვანი და საერთაშორისო სტუდენტებისთვის სრულად ავტომატიზებული სასწავლო გარემო.',
          en: 'A fully automated learning environment for both Georgian-speaking and international students.',
        },
      },
      {
        title: { ka: 'შედეგზე ორიენტირებულობა', en: 'Results-Oriented' },
        description: {
          ka: 'პრაქტიკული მომზადება CDC-ის პლატფორმასა და რეალურ ბაზარზე დასასაქმებლად.',
          en: 'Practical preparation for employment on the CDC platform and in the real job market.',
        },
      },
    ] as MissionPillar[],
    businessValue: {
      heading: { ka: 'ღირებულება ბიზნესისთვის', en: 'Value for Business' },
      points: [
        {
          title: { ka: 'ბაზრის მოთხოვნებთან მყისიერი ადაპტაცია', en: 'Instant Adaptation to Market Demands' },
          description: {
            ka: 'ვქმნით დინამიურ, მოქნილ განათლებას, სადაც სტუდენტი სწავლობს დღესვე მოთხოვნად ციფრულ ინსტრუმენტებს და მარტივად ერგება კომპანიების რეალურ ამოცანებს.',
            en: "We create dynamic, flexible education where students learn today's in-demand digital tools and easily adapt to companies' real-world tasks.",
          },
        },
        {
          title: { ka: 'მზა, პროდუქტიული კადრები', en: 'Ready, Productive Talent' },
          description: {
            ka: 'ბიზნესი იღებს თანამედროვე, აქტუალური უნარებით შეიარაღებულ პრაქტიკოსებს, რომლებსაც პირველივე დღიდან მოაქვთ რეალური შედეგი.',
            en: 'Businesses gain practitioners equipped with modern, up-to-date skills who deliver real results from day one.',
          },
        },
      ] as MissionPillar[],
    },
  },
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
};
