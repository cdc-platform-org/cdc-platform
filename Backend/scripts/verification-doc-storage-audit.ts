// CLI: read-only classification of every User.verificationDocUrl into
// legacy Bunny / Azure-private / null / unexpected. Makes NO database
// changes and NO storage changes — this is a detector, not a backfill
// tool. Existing legacy Bunny documents are left exactly as they are;
// backfilling them to Azure private storage is deliberately out of scope
// until this dry-run has been reviewed (see verificationDocDelivery.ts's
// own header comment for the storage-migration context).
//
// Usage (run from Backend/):
//   npm run verification-docs:audit
//   npm run verification-docs:audit -- --list-unexpected
//
// --list-unexpected  also print the user id (never the URL or any document
//                     content) of every row classified "unexpected", so
//                     each can be inspected individually.
import { PrismaClient } from '@prisma/client';
import { isPrivateVerificationDocRef } from '../src/services/verificationDocDelivery';

const prisma = new PrismaClient();

type Classification = 'bunny' | 'azure-private' | 'unexpected';

// Any plain http(s) URL is treated as "legacy Bunny" here — that also
// correctly covers the rare admin-pasted external URL, since both resolve
// unchanged (passed straight through) by resolveVerificationDocDeliveryUrl.
// Only our own cdcblob:// marker shape counts as "azure-private"; anything
// else (a malformed value, a different scheme) is "unexpected" and worth a
// human look before any future backfill ever touches it.
function classify(url: string): Classification {
  if (isPrivateVerificationDocRef(url)) return 'azure-private';
  if (/^https?:\/\//i.test(url)) return 'bunny';
  return 'unexpected';
}

async function main() {
  const listUnexpected = process.argv.includes('--list-unexpected');
  const users = await prisma.user.findMany({ select: { id: true, verificationDocUrl: true } });

  let nullCount = 0;
  let bunnyCount = 0;
  let azureCount = 0;
  const unexpectedIds: string[] = [];

  for (const user of users) {
    if (!user.verificationDocUrl) {
      nullCount++;
      continue;
    }
    const kind = classify(user.verificationDocUrl);
    if (kind === 'bunny') bunnyCount++;
    else if (kind === 'azure-private') azureCount++;
    else unexpectedIds.push(user.id);
  }

  console.log('=== Verification document storage audit — DRY RUN, no changes made ===');
  console.log(`Legacy Bunny verification docs: ${bunnyCount}`);
  console.log(`Azure-private verification docs: ${azureCount}`);
  console.log(`Null: ${nullCount}`);
  console.log(`Unexpected: ${unexpectedIds.length}`);

  if (unexpectedIds.length && listUnexpected) {
    console.log('\nUser ids with an unexpected verificationDocUrl format (inspect individually — no URL/content printed):');
    for (const id of unexpectedIds) console.log(`  - ${id}`);
  } else if (unexpectedIds.length) {
    console.log('Re-run with --list-unexpected to print the affected user ids.');
  }
}

main()
  .catch((err) => {
    console.error('[verification-doc-storage-audit] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
