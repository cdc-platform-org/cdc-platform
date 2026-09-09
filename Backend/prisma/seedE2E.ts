// Seeds deterministic fixtures for the nightly Playwright QA suite
// (Frontend/e2e/) — run via `pnpm run db:seed:e2e` (see package.json) after
// `prisma migrate deploy` in .github/workflows/qa-nightly.yml, and safe to
// re-run locally against a dev DB (every write is an upsert or a
// delete-then-create, never a bare create that would violate a unique
// constraint on a second run).
//
// Deliberately does NOT cover the real BOG/Stripe checkout flow — there are
// no payment-gateway test credentials available in CI, and hitting a real
// gateway from a nightly job would be both flaky and wrong. Instead this
// seeds a FREE ($0) product (real flow: POST /products/:id/claim, no
// gateway involved) and a CourseEnrollment created directly (bypassing
// checkout, the same way an admin-granted seat or a completed payment
// webhook would leave the DB) so the *enrolled-student experience* is still
// covered end-to-end even though the payment step itself isn't.
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

const QA_TEST_EMAIL = process.env.QA_TEST_EMAIL || 'qa-e2e@cdc.test';
const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD || 'QaE2ePass123!';
// Fixed IDs so the test suite can reference them directly instead of
// querying the DB — this script is the single source of truth for both.
const FREE_PRODUCT_ID = '00000000-0000-4000-8000-00000000f00d';
const COURSE_ID = '00000000-0000-4000-8000-0000000c0575';
const LIVE_TRAINING_ID = '00000000-0000-4000-8000-000000007a10';
const FREE_LIVE_TRAINING_ID = '00000000-0000-4000-8000-000000007a11';
const NOTIFICATION_MARKER = '[QA_E2E_SEED]';
// Fixed tokens (not UUIDs — matches the real random-base64url token shape
// closely enough for routing, and stays readable in test assertions) so
// e2e/live-training-invite.spec.ts can deep-link straight to
// /live-trainings/invite/<token> without querying the DB first. One per
// training: the free one proves an invite CAN fast-track a free
// registration; the paid one proves it can NEVER bypass payment — see
// liveTrainingInviteService.ts's own comment on why that guard lives in
// reserveLearningCheckout, not duplicated here.
const FREE_INVITE_TOKEN = 'qa-e2e-free-invite-token';
const PAID_INVITE_TOKEN = 'qa-e2e-paid-invite-token';

async function main() {
  const passwordHash = await bcrypt.hash(QA_TEST_PASSWORD, 12);

  const testUser = await prisma.user.upsert({
    where: { email: QA_TEST_EMAIL },
    update: { password: passwordHash, status: 'APPROVED', isBanned: false, deletionRequestedAt: null },
    create: {
      email: QA_TEST_EMAIL,
      password: passwordHash,
      name: 'QA E2E Tester',
      role: 'Student',
      status: 'APPROVED',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.digitalProduct.upsert({
    where: { id: FREE_PRODUCT_ID },
    update: { status: 'APPROVED', price: 0 },
    create: {
      id: FREE_PRODUCT_ID,
      title: 'QA E2E Free Product',
      description: 'Seeded fixture for the nightly Playwright suite — a free product used to test the store-purchase (claim) flow without a real payment gateway.',
      price: 0,
      category: 'QA Fixtures',
      imageUrl: 'https://cdc-storage.b-cdn.net/qa-fixtures/free-product.png',
      fileUrl: 'https://cdc-storage.b-cdn.net/qa-fixtures/free-product.zip',
      status: 'APPROVED',
    },
  });

  const course = await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: { status: 'PUBLISHED' },
    create: {
      id: COURSE_ID,
      title: 'QA E2E Test Course',
      description: 'Seeded fixture for the nightly Playwright suite — the test user is pre-enrolled so the enrollment/dashboard flow can be tested without going through real checkout.',
      category: 'QA Fixtures',
      lessons: [],
      originalPrice: 10000,
      status: 'PUBLISHED',
    },
  });

  const section = await prisma.courseSection.upsert({
    where: { id: '00000000-0000-4000-8000-0000005ec710' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-0000005ec710',
      courseId: course.id,
      title: 'Section 1',
      order: 1,
    },
  });

  await prisma.lesson.upsert({
    where: { id: '00000000-0000-4000-8000-00000005e550' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-00000005e550',
      sectionId: section.id,
      title: 'Lesson 1',
      order: 1,
    },
  });

  await prisma.courseEnrollment.upsert({
    where: { userId_courseId: { userId: testUser.id, courseId: course.id } },
    update: {},
    create: { userId: testUser.id, courseId: course.id },
  });

  const training = await prisma.liveTraining.upsert({
    where: { id: LIVE_TRAINING_ID },
    update: { published: true, price: 10000, isOnSale: false, maxCapacity: 100 },
    create: {
      id: LIVE_TRAINING_ID,
      title: 'QA E2E Live Training',
      titleEn: 'QA E2E Live Training',
      description: 'Seeded training for rating and media tests. Payment endpoints are intercepted by Playwright.',
      category: 'QA Fixtures',
      scheduledAt: new Date('2030-01-15T14:00:00Z'),
      price: 10000,
      priceType: 'TOTAL',
      minCapacity: 1,
      maxCapacity: 100,
      published: true,
      language: 'BOTH',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      trainerVideoUrl: 'https://vimeo.com/76979871',
    },
  });
  await prisma.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: testUser.id, liveTrainingId: training.id } },
    update: { status: 'ACTIVE' },
    create: { userId: testUser.id, liveTrainingId: training.id },
  });

  const freeTraining = await prisma.liveTraining.upsert({
    where: { id: FREE_LIVE_TRAINING_ID },
    update: { published: true, price: null, maxCapacity: 100 },
    create: {
      id: FREE_LIVE_TRAINING_ID,
      title: 'QA E2E Free Live Training',
      titleEn: 'QA E2E Free Live Training',
      description: 'Seeded FREE training for the invite/QR redemption e2e test.',
      category: 'QA Fixtures',
      scheduledAt: new Date('2030-02-15T14:00:00Z'),
      price: null,
      priceType: 'TOTAL',
      minCapacity: 1,
      maxCapacity: 100,
      published: true,
      language: 'BOTH',
    },
  });
  await prisma.liveTrainingInvite.upsert({
    where: { token: FREE_INVITE_TOKEN },
    update: { revokedAt: null, expiresAt: null, maxRedemptions: 1000 },
    create: { token: FREE_INVITE_TOKEN, liveTrainingId: freeTraining.id, maxRedemptions: 1000, createdById: testUser.id },
  });
  await prisma.liveTrainingInvite.upsert({
    where: { token: PAID_INVITE_TOKEN },
    update: { revokedAt: null, expiresAt: null, maxRedemptions: 1000 },
    create: { token: PAID_INVITE_TOKEN, liveTrainingId: training.id, maxRedemptions: 1000, createdById: testUser.id },
  });

  // Enrolled (not just invited) so the QA user has real IAKO entitlement on
  // the free training for e2e/iako-mentor-journey.spec.ts — that entitlement
  // check (services/trainingGuideService.ts's requireTrainingGuideAccess)
  // is the same real enrollment check the whole platform uses, not a test-
  // only shortcut.
  await prisma.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: testUser.id, liveTrainingId: freeTraining.id } },
    update: { status: 'ACTIVE' },
    create: { userId: testUser.id, liveTrainingId: freeTraining.id },
  });

  // IAKO — a Vibe Coding mentor profile assigned to the free training, with
  // small usage limits so e2e/iako-mentor-journey.spec.ts's limit-related
  // assertions run fast against a real (not mocked) AI provider call.
  const iakoProfile = await prisma.iakoAssistantProfile.upsert({
    where: { id: '00000000-0000-4000-8000-00000000ia50' },
    update: {
      name: 'Vibe Coding Mentor', mentorTagline: 'Vibe Coding Full-Stack AI Mentor', active: true,
      inScope: 'React/Next.js frontend, Node/Express backend, Supabase (auth, database, storage), GitHub, Vercel deployment, HTML/CSS/JavaScript, debugging errors, and building a full-stack project during this training.',
      outOfScope: 'Anything unrelated to this training\'s tech stack or the learner\'s own project — general trivia, other subjects, personal/financial/medical advice.',
    },
    create: {
      id: '00000000-0000-4000-8000-00000000ia50', name: 'Vibe Coding Mentor', mentorTagline: 'Vibe Coding Full-Stack AI Mentor',
      welcomeMessageKa: 'გამარჯობა, მე ვარ IAKO 👋 შენი Vibe Coding ტრენინგის AI ტექნიკური ასისტენტი ვარ.',
      welcomeMessageEn: 'Hi, I\'m IAKO 👋 Your Vibe Coding training\'s AI technical assistant.',
      systemPrompt: 'You are IAKO, a full-stack developer mentor for the Vibe Coding training.',
      inScope: 'React/Next.js frontend, Node/Express backend, Supabase (auth, database, storage), GitHub, Vercel deployment, HTML/CSS/JavaScript, debugging errors, and building a full-stack project during this training.',
      outOfScope: 'Anything unrelated to this training\'s tech stack or the learner\'s own project — general trivia, other subjects, personal/financial/medical advice.',
      visionEnabled: true, temperature: 0.2, active: true,
      defaultRequestLimit: 50, defaultDailyRequestLimit: 30, defaultHourlyRequestLimit: 10,
      defaultScreenshotLimit: 10, defaultMaxScreenshotsPerMessage: 3, defaultAccessDays: 10,
      createdById: testUser.id,
    },
  });
  await prisma.iakoProfileAssignment.upsert({
    where: { liveTrainingId: freeTraining.id },
    update: { profileId: iakoProfile.id },
    create: { liveTrainingId: freeTraining.id, profileId: iakoProfile.id },
  });

  // Notifications have no natural unique key to upsert on — delete any
  // prior seed run's notification for this user before creating a fresh
  // one, so re-seeding stays idempotent (exactly one QA notification, not
  // one more per run) instead of growing an unbounded read/unread history.
  await prisma.notification.deleteMany({ where: { userId: testUser.id, title: { startsWith: NOTIFICATION_MARKER } } });
  await prisma.notification.create({
    data: {
      userId: testUser.id,
      title: `${NOTIFICATION_MARKER} Welcome`,
      message: 'This is a seeded notification for the nightly Playwright suite.',
      type: 'SYSTEM',
    },
  });

  console.log('E2E fixtures seeded:', {
    testUser: testUser.email,
    freeProductId: FREE_PRODUCT_ID,
    courseId: COURSE_ID,
    liveTrainingId: LIVE_TRAINING_ID,
    freeLiveTrainingId: freeTraining.id,
    freeInviteToken: FREE_INVITE_TOKEN,
    paidInviteToken: PAID_INVITE_TOKEN,
    iakoProfileId: iakoProfile.id,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
