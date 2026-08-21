// Bootstraps accounts that have no API path to create themselves: the very
// first SuperAdmin, and (optionally) an initial Client. Registration now supports self-serve Client sign-up too, so this is mostly useful for pre-approving one without them registering first
// defaults to Student but accepts Client too (see schemas/authSchemas.ts), and the
// admin routes only approve/reject — there is no role-change endpoint — so
// without this script there is no way to ever get past the first account.
//
// SuperAdmin credentials are read from SEED_SUPERADMIN_EMAIL/PASSWORD when
// set. If either is missing, this falls back to a fixed local-dev default
// (see DEFAULT_SUPERADMIN_EMAIL/PASSWORD below) so a fresh clone can seed
// with zero .env setup — a console.warn fires whenever that fallback is
// used, since these defaults are public (committed in this file) and must
// never be relied on outside a disposable local dev database. Run with:
//   SEED_SUPERADMIN_EMAIL=... SEED_SUPERADMIN_PASSWORD=... pnpm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Default forum categories — the forum has no self-serve way to create a
// category (that's admin-only, see routes/adminForum.ts), so a fresh DB
// would otherwise show an empty /forum page forever. Upserted by slug so
// re-running the seed is safe and never clobbers admin edits to name/description.
const DEFAULT_FORUM_CATEGORIES = [
  {
    slug: 'general',
    name: 'ზოგადი დისკუსია',
    description: 'ზოგადი თემები და საუბრები საზოგადოებისთვის.',
  },
  {
    slug: 'courses',
    name: 'კურსები და სწავლება',
    description: 'კითხვები და გამოცდილება კურსების შესახებ.',
  },
  {
    slug: 'freelance',
    name: 'ფრილანსი და პროექტები',
    description: 'გიგების, ვაკანსიების და პროექტების განხილვა.',
  },
  {
    slug: 'help',
    name: 'დახმარება და მხარდაჭერა',
    description: 'ტექნიკური თუ ორგანიზაციული საკითხები პლატფორმაზე.',
  },
];

async function seedForumCategories() {
  for (const category of DEFAULT_FORUM_CATEGORIES) {
    await prisma.forumCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }
  console.log(`Forum categories ready: ${DEFAULT_FORUM_CATEGORIES.length} default categories seeded.`);
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Set it before running the seed script.`);
  }
  return value;
}

// Local-dev-only fallback — see the file header comment. Never used when
// SEED_SUPERADMIN_EMAIL/PASSWORD are actually set (every real deployment
// should set them).
const DEFAULT_SUPERADMIN_EMAIL = 'admin@cdc.ge';
const DEFAULT_SUPERADMIN_PASSWORD = 'Admin123!456';

async function main() {
  await seedForumCategories();

  if (!process.env.SEED_SUPERADMIN_EMAIL || !process.env.SEED_SUPERADMIN_PASSWORD) {
    console.warn(
      '⚠ SEED_SUPERADMIN_EMAIL/SEED_SUPERADMIN_PASSWORD not set — falling back to local default credentials ' +
        `(${DEFAULT_SUPERADMIN_EMAIL}). These are committed in prisma/seed.ts and are NOT secret — never rely on ` +
        'them outside a disposable local dev database.'
    );
  }
  const superAdminEmail = (process.env.SEED_SUPERADMIN_EMAIL ?? DEFAULT_SUPERADMIN_EMAIL).toLowerCase();
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? DEFAULT_SUPERADMIN_PASSWORD;
  if (superAdminPassword.length < 8) {
    throw new Error('SEED_SUPERADMIN_PASSWORD must be at least 8 characters.');
  }
  const superAdminName = process.env.SEED_SUPERADMIN_NAME ?? 'System Admin';

  // Only ensures role/status/adminRole on an existing account — deliberately
  // does not touch `password` on update, so accidentally re-running this
  // script can't clobber a password that's since been rotated for real.
  // adminRole: 'SUPER_ADMIN' is the internal admin-TEAM tier (separate from
  // the marketplace `role`) that the /admin panel's RBAC checks against —
  // this is what "guarantees your account has SUPER_ADMIN status" for the
  // admin panel specifically, not just the legacy role field.
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { role: 'SuperAdmin', status: 'APPROVED', adminRole: 'SUPER_ADMIN' },
    create: {
      name: superAdminName,
      email: superAdminEmail,
      password: await bcrypt.hash(superAdminPassword, 12),
      role: 'SuperAdmin',
      status: 'APPROVED',
      adminRole: 'SUPER_ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`SuperAdmin ready: ${superAdmin.email} (${superAdmin.id}) — adminRole: ${superAdmin.adminRole}`);

  const enterpriseEmail = process.env.SEED_ENTERPRISE_EMAIL?.toLowerCase();
  if (!enterpriseEmail) {
    console.log('SEED_ENTERPRISE_EMAIL not set — skipping initial Client seed.');
    return;
  }

  const enterprisePassword = requireEnv('SEED_ENTERPRISE_PASSWORD');
  if (enterprisePassword.length < 8) {
    throw new Error('SEED_ENTERPRISE_PASSWORD must be at least 8 characters.');
  }
  const enterpriseName = process.env.SEED_ENTERPRISE_NAME ?? 'Client';

  const enterprise = await prisma.user.upsert({
    where: { email: enterpriseEmail },
    update: { role: 'Client', status: 'APPROVED' },
    create: {
      name: enterpriseName,
      email: enterpriseEmail,
      password: await bcrypt.hash(enterprisePassword, 12),
      role: 'Client',
      status: 'APPROVED',
    },
  });
  console.log(`Client ready: ${enterprise.email} (${enterprise.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
