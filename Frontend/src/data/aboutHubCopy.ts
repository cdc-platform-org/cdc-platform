import type { AboutCollection, AboutSection } from '../types/aboutHub';

export const ABOUT_PATHS: Record<AboutSection, string> = {
  overview: '/about', gallery: '/about/gallery', projects: '/about/projects', stories: '/about/success-stories', partners: '/about/partners',
};
const ka = {
  eyebrow: 'ციფრული პროფესიების ცენტრი', home: 'მთავარი', about: 'ჩვენ შესახებ',
  sections: { overview: 'ცენტრის შესახებ', gallery: 'გალერეა', projects: 'პროექტები', stories: 'წარმატებული ქეისები', partners: 'პარტნიორები და დონორები' },
  titles: { gallery: 'სივრცე, სადაც იდეები ცოცხლდება.', projects: 'ინიციატივები, რომლებიც შესაძლებლობებს ქმნის.', stories: 'ყოველ ახალ კარიერას თავისი ისტორია აქვს.', partners: 'მეტ შესაძლებლობას ერთად ვქმნით.' },
  descriptions: {
    gallery: 'ტრენინგები, ვორქშოფები, ბუთქემფები და შეხვედრები — დაათვალიერეთ ჩვენი სასწავლო გარემო.',
    projects: 'საგანმანათლებლო, რეგიონული და საგრანტო პროგრამები: მიზნები, თანამშრომლობა და შედეგები.',
    stories: 'სწავლის შემდეგი ნაბიჯი: კარიერის ცვლილება, ფრილანსი და დასაქმების შესაძლებლობები.',
    partners: 'ორგანიზაციები და მხარდამჭერები, რომლებიც ციფრულ განათლებასა და პროფესიულ განვითარებაში მონაწილეობენ.',
  },
  categories: { all: 'ყველა', training: 'ტრენინგები', workshop: 'ვორქშოფები', bootcamp: 'ბუთქემფები', event: 'ღონისძიებები', regional: 'რეგიონული', education: 'საგანმანათლებლო', grant: 'საგრანტო', transition: 'კარიერის ცვლილება', freelance: 'ფრილანსი', employment: 'დასაქმება', donor: 'დონორები', technology: 'ტექნოლოგიური', community: 'სათემო', institutional: 'ინსტიტუციური', team: 'გუნდი' },
  mission: 'ჩვენი მისია', vision: 'ჩვენი ხედვა', ecosystem: 'ერთი პლატფორმა. მეტი შესაძლებლობა.',
  ecosystemIntro: 'ისწავლეთ ახალი პროფესია, გამოიყენეთ ციფრული ინსტრუმენტები და გაიცანით პროფესიული საზოგადოება.',
  pillars: ['ციფრული კოლეჯი', 'ციფრული მარკეტი და AI', 'დასაქმება', 'ფორუმი'],
  pillarDescriptions: ['პრაქტიკული კურსები და მენტორობა', 'ციფრული პროდუქტები და სამუშაო ინსტრუმენტები', 'ვაკანსიები და კარიერის შემდეგი ნაბიჯი', 'იდეები, კითხვები და გამოცდილების გაზიარება'],
  team: 'ადამიანები შესაძლებლობების უკან', accreditations: 'აკრედიტაციები და გამჭვირვალობა',
  demo: 'საილუსტრაციო ჩანაწერი', demoNotice: 'მონიშნული ჩანაწერები, ფოტოები და მაჩვენებლები საილუსტრაციოა და CDC-ის დადასტურებულ შედეგებს არ წარმოადგენს.',
  empty: 'ამ კატეგორიაში ჩანაწერები ჯერ არ არის.', emptyHint: 'ახალი აქტივობები გამოქვეყნებისთანავე აქ გამოჩნდება.', reset: 'ყველას ნახვა',
  count: 'ჩანაწერი', filter: 'კატეგორიის არჩევა', sort: 'დალაგება', newest: 'უახლესი ჯერ', oldest: 'ძველი ჯერ',
  timeline: 'განხორციელების პერიოდი', collaborators: 'პარტნიორები', impact: 'შედეგი', details: 'ვრცლად', visit: 'ვებგვერდი', document: 'დოკუმენტის ნახვა',
  connect: 'შემდეგ შესაძლებლობას ერთად შევქმნით.', connectText: 'გაქვთ იდეა, სასწავლო ინიციატივა ან თანამშრომლობის სურვილი? გაგვიზიარეთ.', contact: 'დაგვიკავშირდით', explore: 'გაიცანით ჩვენი საქმიანობა',
  loading: 'კონტენტი იტვირთება', error: 'კონტენტის განახლება ვერ მოხერხდა. ნაჩვენებია საწყისი ვერსია.', retry: 'ხელახლა ცდა',
  close: 'დახურვა', previous: 'წინა ფოტო', next: 'შემდეგი ფოტო', zoomIn: 'გადიდება', zoomOut: 'შემცირება', lightbox: 'ფოტოს გადახედვა',
};
const en: typeof ka = {
  eyebrow: 'Center of Digital Careers', home: 'Home', about: 'About Us',
  sections: { overview: 'About the center', gallery: 'Gallery', projects: 'Projects', stories: 'Success stories', partners: 'Partners & donors' },
  titles: { gallery: 'Where ideas come to life.', projects: 'Initiatives that open doors.', stories: 'Every new career has a story.', partners: 'More possibilities, together.' },
  descriptions: { gallery: 'Training, workshops, bootcamps and meetups — a closer look at our learning environment.', projects: 'Educational, regional and grant programmes: their purpose, collaborations and outcomes.', stories: 'What comes after learning: career transitions, freelance work and employment opportunities.', partners: 'The organisations and supporters contributing to digital education and professional growth.' },
  categories: { all: 'All', training: 'Training', workshop: 'Workshops', bootcamp: 'Bootcamps', event: 'Events', regional: 'Regional', education: 'Education', grant: 'Grants', transition: 'Career transitions', freelance: 'Freelance', employment: 'Employment', donor: 'Donors', technology: 'Technology', community: 'Community', institutional: 'Institutional', team: 'Team' },
  mission: 'Our mission', vision: 'Our vision', ecosystem: 'One platform. More possibilities.',
  ecosystemIntro: 'Learn a new profession, use digital tools and meet your professional community.',
  pillars: ['Digital College', 'Digital Market & AI', 'Employment', 'Forum'],
  pillarDescriptions: ['Practical courses and mentoring', 'Digital products and tools for your work', 'Vacancies and your next career step', 'Ideas, questions and shared experience'],
  team: 'The people behind the possibilities', accreditations: 'Accreditations & transparency',
  demo: 'Illustrative entry', demoNotice: 'Marked entries, photographs and metrics are illustrative and do not represent verified CDC outcomes.',
  empty: 'No entries in this category yet.', emptyHint: 'New activities will appear here once published.', reset: 'View all',
  count: 'entries', filter: 'Choose a category', sort: 'Sort by', newest: 'Newest first', oldest: 'Oldest first',
  timeline: 'Project timeline', collaborators: 'Partners', impact: 'Outcome', details: 'Read more', visit: 'Visit website', document: 'View document',
  connect: 'Let’s create the next opportunity.', connectText: 'Have an idea, a learning initiative or a collaboration in mind? We would love to hear it.', contact: 'Get in touch', explore: 'Explore our work',
  loading: 'Loading content', error: 'Content could not be refreshed. Showing the starter version.', retry: 'Try again',
  close: 'Close', previous: 'Previous image', next: 'Next image', zoomIn: 'Zoom in', zoomOut: 'Zoom out', lightbox: 'Image preview',
};
export const ABOUT_COPY = { ka, en };
export const ABOUT_CATEGORIES: Record<AboutCollection, string[]> = {
  gallery: ['training', 'workshop', 'bootcamp', 'event'], projects: ['education', 'regional', 'grant'], stories: ['transition', 'freelance', 'employment'], partners: ['donor', 'technology', 'institutional', 'community', 'education'],
};
