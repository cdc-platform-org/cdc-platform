// Bootstraps accounts that have no API path to create themselves: the very
// first SuperAdmin, and (optionally) an initial Client. Registration now supports self-serve Client sign-up too, so this is mostly useful for pre-approving one without them registering first
// defaults to Student but accepts Client too (see schemas/authSchemas.ts), and the
// admin routes only approve/reject — there is no role-change endpoint — so
// without this script there is no way to ever get past the first account.
//
// Credentials are read from environment variables only. Nothing here is
// hardcoded or committed. Run with:
//   SEED_SUPERADMIN_EMAIL=... SEED_SUPERADMIN_PASSWORD=... pnpm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Set it before running the seed script.`);
  }
  return value;
}

async function main() {
  const superAdminEmail = requireEnv('SEED_SUPERADMIN_EMAIL').toLowerCase();
  const superAdminPassword = requireEnv('SEED_SUPERADMIN_PASSWORD');
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
