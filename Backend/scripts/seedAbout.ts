import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { aboutHubSchema } from '../src/services/cms/aboutHubSchema';

// Explicit, idempotent seed: never overwrites existing editorial content.
async function main() {
  const content = aboutHubSchema.parse(JSON.parse(readFileSync(resolve(__dirname, '../../Frontend/src/data/aboutHubSeed.json'), 'utf8')));
  const prisma = new PrismaClient();
  try {
    await prisma.siteContent.upsert({ where: { page: 'about' }, create: { page: 'about', content }, update: {} });
    console.log('About hub is ready; existing content was preserved.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('About seed failed. Check database connectivity and the seed schema.'); process.exitCode = 1; });
