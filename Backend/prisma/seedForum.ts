// Seeds a handful of realistic, pre-approved Georgian forum threads so a
// fresh /forum page isn't empty. Deliberately standalone from seed.ts's
// main() — that script requires SEED_SUPERADMIN_EMAIL/PASSWORD env vars
// before it does anything, which this shouldn't depend on. Idempotent: reruns
// upsert the categories and skip any thread whose title already exists.
//
// Run with: pnpm exec ts-node prisma/seedForum.ts   (or: npm run db:seed:forum)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Kept in sync by hand with routes/forum.ts's DEFAULT_FORUM_CATEGORIES /
// prisma/seed.ts's DEFAULT_FORUM_CATEGORIES, same duplication rationale
// (this script runs standalone via ts-node, outside src's rootDir).
const DEFAULT_FORUM_CATEGORIES = [
  { slug: 'general', name: 'ზოგადი დისკუსია', description: 'ზოგადი თემები და საუბრები საზოგადოებისთვის.' },
  { slug: 'courses', name: 'კურსები და სწავლება', description: 'კითხვები და გამოცდილება კურსების შესახებ.' },
  { slug: 'freelance', name: 'ფრილანსი და პროექტები', description: 'გიგების, ვაკანსიების და პროექტების განხილვა.' },
  { slug: 'help', name: 'დახმარება და მხარდაჭერა', description: 'ტექნიკური თუ ორგანიზაციული საკითხები პლატფორმაზე.' },
];

// Author for the seeded threads. isVerifiedGraduate so it never trips the
// non-graduate monthly post limit if this script is ever pointed at a
// non-empty DB. Password is a random, never-communicated hash — this
// account isn't meant to be logged into, only to attribute seed content.
const SEED_AUTHOR_EMAIL = 'cdc-team@cdc.ge';

const SEED_THREADS: { categorySlug: string; title: string; content: string }[] = [
  {
    categorySlug: 'general',
    title: 'როგორ დავიწყოთ IT კარიერა?',
    content:
      'გამარჯობა ყველას! ბევრი კითხულობთ, საიდან დავიწყოთ IT კარიერა ნულიდან. ჩემი რჩევაა: აირჩიეთ ერთი მიმართულება (მაგ. ვებ დეველოპმენტი, დიზაინი, მარკეტინგი), გაიარეთ სტრუქტურირებული კურსი და აუცილებლად იმუშავეთ პრაქტიკულ პროექტებზე კურსის პარალელურად — პორტფოლიო გაცილებით მეტს ღირს, ვიდრე მარტო სერტიფიკატი. რას ურჩევდით დამწყებებს თქვენ?',
  },
  {
    categorySlug: 'general',
    title: 'CDC Studio-ს სიახლეები',
    content:
      'CDC Studio განაგრძობს ზრდას — ბოლო თვეებში რამდენიმე ახალი პროექტი დავასრულეთ რეალურ ბიზნეს კლიენტებთან ერთად (ვებგვერდები, ბრენდინგი, UI/UX დიზაინი). თუ სტუდენტი ხართ და გსურთ სტუდიოს პროექტებში ჩართვა პრაქტიკის სახით, დაწერეთ კომენტარებში ან მიმართეთ თქვენს მენტორს.',
  },
  {
    categorySlug: 'freelance',
    title: 'ფრილანსერის რჩევები',
    content:
      'პირველი კლიენტის პოვნა ყველაზე რთული ნაწილია. რამდენიმე რჩევა, რაც მე დამეხმარა: 1) ააწყვეთ მცირე, მაგრამ ხარისხიანი პორტფოლიო, თუნდაც საკუთარი/საცდელი პროექტებით. 2) დაიწყეთ პლატფორმის შიდა გიგებით — რეპუტაცია და შეფასებები აქედან იწყება. 3) ნუ დააფასებთ თავს იაფად პირველივე პროექტზე, მაგრამ ნუ მოითხოვთ არარეალურ ფასს გამოცდილების გარეშე. თქვენი გამოცდილება რა იყო?',
  },
  {
    categorySlug: 'courses',
    title: 'რომელი კურსი ავირჩიო?',
    content:
      'ხშირად მეკითხებიან, როგორ ავირჩიო კურსი კარიერული მიმართულების მიხედვით. ჩემი პრინციპია: შეხედეთ არა მხოლოდ სილაბუსს, არამედ იმასაც, რამდენად პრაქტიკულია დავალებები და აქვს თუ არა კურსს რეალური სასერტიფიკატო გამოცდა. თუ გაქვთ კითხვები კონკრეტულ კურსებზე, დაწერეთ აქ — ვეცდები ვუპასუხო ან გადავამისამართო შესაბამის მენტორთან.',
  },
];

async function main() {
  console.log('Seeding default forum categories…');
  const categoriesBySlug = new Map<string, { id: string }>();
  for (const category of DEFAULT_FORUM_CATEGORIES) {
    const saved = await prisma.forumCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
    categoriesBySlug.set(category.slug, saved);
  }

  console.log('Ensuring seed author account exists…');
  const author = await prisma.user.upsert({
    where: { email: SEED_AUTHOR_EMAIL },
    update: {},
    create: {
      name: 'CDC Team',
      email: SEED_AUTHOR_EMAIL,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12),
      role: 'Mentor',
      status: 'APPROVED',
      emailVerifiedAt: new Date(),
      isVerifiedGraduate: true,
    },
  });
  console.log(`Seed author ready: ${author.email} (${author.id})`);

  console.log('Seeding forum threads…');
  let created = 0;
  for (const thread of SEED_THREADS) {
    const category = categoriesBySlug.get(thread.categorySlug);
    if (!category) continue;

    const existing = await prisma.forumThread.findFirst({
      where: { categoryId: category.id, title: thread.title },
      select: { id: true },
    });
    if (existing) {
      console.log(`Skipping (already exists): "${thread.title}"`);
      continue;
    }

    await prisma.forumThread.create({
      data: {
        categoryId: category.id,
        authorId: author.id,
        title: thread.title,
        content: thread.content,
        moderationStatus: 'APPROVED',
      },
    });
    created += 1;
    console.log(`Created: "${thread.title}"`);
  }

  console.log(`Done. ${created} new thread(s) created.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
