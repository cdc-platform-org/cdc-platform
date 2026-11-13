/**
 * Service (account & trust (access grants, audit, KYC, moderation, cleanup)).
 * Exports: CleanupResult, cleanupExpiredDeletedAccounts.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HARD_DELETE_AFTER_DAYS = 60;

export interface CleanupResult {
  hardDeletedUserIds: string[];
  anonymizedUserIds: string[];
  failures: { userId: string; error: string }[];
}

// 60 days after a user requests deletion (see /api/auth/delete-account), this
// permanently cleans up their account. Two outcomes, decided per-user:
//
//   1. Hard delete — if nothing references this user's row (no gigs, no
//      transactions, no reviews, no messages, etc.), the row is deleted
//      outright. PaymentMethod rows cascade automatically.
//
//   2. Anonymize — most real accounts have SOME activity history, and that
//      history is deliberately protected with onDelete: Restrict everywhere
//      in the schema (GigTransaction, WalletEntry, Review, ...), because a
//      GigTransaction/WalletEntry often also belongs to the OTHER party in a
//      deal — hard-deleting it to satisfy this user's deletion request would
//      silently corrupt a still-active, uninvolved user's financial/audit
//      history. So instead we scrub PII (name, email, password) and leave
//      the row (and everything that legitimately references it) intact.
//      dataPurgedAt marks this as done so the cron doesn't reprocess it.
//
// Not implemented: deleting "uploaded files" — there is no table anywhere in
// this schema that tracks which uploaded files (Azure video blobs, local
// blog images) belong to which user, so there is nothing to query and
// nothing safe to delete here without that ownership tracking existing
// first. This is a real gap, not an oversight to gloss over.
export async function cleanupExpiredDeletedAccounts(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - HARD_DELETE_AFTER_DAYS * MS_PER_DAY);
  const expiredUsers = await prisma.user.findMany({
    where: { deletionRequestedAt: { lte: cutoff }, dataPurgedAt: null },
    select: { id: true },
  });

  const hardDeletedUserIds: string[] = [];
  const anonymizedUserIds: string[] = [];
  const failures: { userId: string; error: string }[] = [];

  for (const { id } of expiredUsers) {
    try {
      await prisma.user.delete({ where: { id } });
      hardDeletedUserIds.push(id);
      continue;
    } catch {
      // Foreign-key restricted — fall through to anonymization below.
    }

    try {
      const tombstonePassword = await bcrypt.hash(crypto.randomUUID(), 12);
      await prisma.$transaction([
        prisma.paymentMethod.deleteMany({ where: { userId: id } }),
        prisma.user.update({
          where: { id },
          data: {
            name: 'Deleted User',
            email: `deleted-${id}@deleted.cdc-platform.local`,
            password: tombstonePassword,
            dataPurgedAt: new Date(),
          },
        }),
      ]);
      anonymizedUserIds.push(id);
    } catch (err: any) {
      failures.push({ userId: id, error: err?.message ?? 'Unknown error during anonymization' });
    }
  }

  return { hardDeletedUserIds, anonymizedUserIds, failures };
}
