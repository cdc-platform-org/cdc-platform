// Populates realistic starter courses + curriculum (matching the programs
// already advertised on the homepage) so the LMS has real content to browse,
// purchase, and learn from instead of an empty catalog. Safe to re-run:
// matches courses by title and only creates curriculum for courses that
// don't have any sections yet, so it won't duplicate content or clobber
// anything an admin has since edited by hand.
//
// Run with: npx ts-node scripts/seedCourses.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LessonSeed {
  title: string;
  durationSeconds: number;
}

interface SectionSeed {
  title: string;
  lessons: LessonSeed[];
}

interface CourseSeed {
  title: string;
  description: string;
  category: string;
  price: number; // minor units (tetri) — matches GigApplication.bidAmount/Gig.budgetAmount convention
  mentorName: string;
  mentorTitle: string;
  sections: SectionSeed[];
}

const COURSES: CourseSeed[] = [
  {
    title: 'Vibe Coding - ვებ-დეველოპმენტი AI-ით',
    description:
      'რეალური ვებ პროექტების შექმნა, კოდის გენერირება ხელოვნური ინტელექტის დახმარებით და მონაცემთა ბაზების ინტეგრაცია. კურსი მოიცავს HTML/CSS/JavaScript საფუძვლებს, თანამედროვე React ეკოსისტემას და AI კოდის ასისტენტების პრაქტიკულ გამოყენებას.',
    category: 'პროგრამირება',
    // Live BOG smoke-test pricing — 1 GEL (100 tetri), not the real launch price.
    price: 100,
    mentorName: 'იმედო მარტიკოვი',
    mentorTitle: 'კურსის ლექტორი & AI ინჟინერი',
    sections: [
      {
        title: 'შესავალი და გარემოს მომზადება',
        lessons: [
          { title: 'კურსის მიმოხილვა და მიზნები', durationSeconds: 300 },
          { title: 'დეველოპერული გარემოს დაყენება', durationSeconds: 600 },
          { title: 'Git და ვერსიების კონტროლი', durationSeconds: 480 },
        ],
      },
      {
        title: 'HTML, CSS და თანამედროვე UI',
        lessons: [
          { title: 'სემანტიკური HTML', durationSeconds: 540 },
          { title: 'Flexbox და Grid სისტემები', durationSeconds: 720 },
          { title: 'რესპონსული დიზაინი', durationSeconds: 660 },
        ],
      },
      {
        title: 'JavaScript და AI ასისტირებული კოდირება',
        lessons: [
          { title: 'JavaScript საფუძვლები', durationSeconds: 900 },
          { title: 'AI კოდის გენერატორების გამოყენება', durationSeconds: 780 },
          { title: 'React-ის შესავალი', durationSeconds: 840 },
        ],
      },
      {
        title: 'პროექტის დასრულება',
        lessons: [
          { title: 'სრული პროექტის აწყობა', durationSeconds: 1200 },
          { title: 'დეპლოიმენტი და პორტფოლიო', durationSeconds: 600 },
        ],
      },
    ],
  },
  {
    title: 'Social Media Marketing & AI',
    description:
      'ბიზნეს გვერდების ოპტიმიზაცია, Google SEO, სარეკლამო კამპანიების მართვა და AI კონტენტის გენერაცია. კურსი მიმართულია ადგილობრივი ბიზნესებისა და პირადი ბრენდის ციფრული ზრდისკენ.',
    category: 'მარკეტინგი',
    // Live BOG smoke-test pricing — 1 GEL (100 tetri), not the real launch price.
    price: 100,
    mentorName: 'მარიკა გაგუა',
    mentorTitle: 'კურსის ლექტორი & SMM სტრატეგი',
    sections: [
      {
        title: 'სოციალური მედიის საფუძვლები',
        lessons: [
          { title: 'პლატფორმების სტრატეგია', durationSeconds: 480 },
          { title: 'ბრენდის ხმის ჩამოყალიბება', durationSeconds: 420 },
        ],
      },
      {
        title: 'კონტენტის შექმნა AI-ით',
        lessons: [
          { title: 'AI კონტენტის გენერაცია', durationSeconds: 600 },
          { title: 'ვიზუალური კონტენტის დიზაინი', durationSeconds: 540 },
        ],
      },
      {
        title: 'სარეკლამო კამპანიები & Google SEO',
        lessons: [
          { title: 'სარეკლამო კამპანიის აწყობა', durationSeconds: 720 },
          { title: 'SEO ოპტიმიზაცია', durationSeconds: 660 },
          { title: 'ანალიტიკა და KPI', durationSeconds: 480 },
        ],
      },
    ],
  },
  {
    title: 'Figma გრაფიკული დიზაინი & AI',
    description:
      'თანამედროვე ინტერფეისების დიზაინი, პროტოტიპირება და ხელოვნური ინტელექტის გენერაციული მოდელები. კურსი გაძღვება ნულიდან პირველი პორტფოლიო პროექტის დასრულებამდე.',
    category: 'დიზაინი',
    // Live BOG smoke-test pricing — 1 GEL (100 tetri), not the real launch price.
    price: 100,
    mentorName: 'ია თავდიშვილი',
    mentorTitle: 'კურსის მენტორი & დირექტორი',
    sections: [
      {
        title: 'Figma-ს საფუძვლები',
        lessons: [
          { title: 'ინტერფეისი და ინსტრუმენტები', durationSeconds: 420 },
          { title: 'Auto Layout და კომპონენტები', durationSeconds: 600 },
        ],
      },
      {
        title: 'UI/UX დიზაინის პრინციპები',
        lessons: [
          { title: 'მომხმარებლის კვლევა', durationSeconds: 480 },
          { title: 'Wireframing და პროტოტიპირება', durationSeconds: 660 },
        ],
      },
      {
        title: 'AI გენერაციული დიზაინი',
        lessons: [
          { title: 'AI დიზაინის ინსტრუმენტები', durationSeconds: 540 },
          { title: 'საბოლოო პროექტის პრეზენტაცია', durationSeconds: 480 },
        ],
      },
    ],
  },
];

async function main() {
  for (const courseSeed of COURSES) {
    const existing = await prisma.course.findFirst({ where: { title: courseSeed.title } });

    const course = existing
      ? await prisma.course.update({
          where: { id: existing.id },
          data: {
            description: courseSeed.description,
            category: courseSeed.category,
            price: courseSeed.price,
            mentorName: courseSeed.mentorName,
            mentorTitle: courseSeed.mentorTitle,
            published: true,
          },
        })
      : await prisma.course.create({
          data: {
            title: courseSeed.title,
            description: courseSeed.description,
            category: courseSeed.category,
            price: courseSeed.price,
            mentorName: courseSeed.mentorName,
            mentorTitle: courseSeed.mentorTitle,
            published: true,
            // Legacy field the create schema still requires — real curriculum
            // lives in the relational sections/lessons created below.
            lessons: [{ title: courseSeed.title, content: courseSeed.description, durationMinutes: 1 }],
          },
        });
    console.log(`${existing ? 'Updated' : 'Created'} course: ${course.title} (${course.id})`);

    const sectionCount = await prisma.courseSection.count({ where: { courseId: course.id } });
    if (sectionCount > 0) {
      console.log(`  Skipping curriculum — ${sectionCount} section(s) already exist (won't overwrite admin edits).`);
      continue;
    }

    for (let sectionOrder = 0; sectionOrder < courseSeed.sections.length; sectionOrder++) {
      const sectionSeed = courseSeed.sections[sectionOrder];
      const section = await prisma.courseSection.create({
        data: { courseId: course.id, title: sectionSeed.title, order: sectionOrder },
      });
      for (let lessonOrder = 0; lessonOrder < sectionSeed.lessons.length; lessonOrder++) {
        const lessonSeed = sectionSeed.lessons[lessonOrder];
        await prisma.lesson.create({
          data: {
            sectionId: section.id,
            title: lessonSeed.title,
            durationSeconds: lessonSeed.durationSeconds,
            order: lessonOrder,
            // bunnyVideoId intentionally left null — upload real lesson videos
            // via /admin/courses once a Bunny Stream library is configured.
          },
        });
      }
      console.log(`  Section "${section.title}" — ${sectionSeed.lessons.length} lesson(s)`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
