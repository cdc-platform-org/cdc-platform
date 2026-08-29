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
const NOTIFICATION_MARKER = '[QA_E2E_SEED]';

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
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
