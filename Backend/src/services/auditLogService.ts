import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Fire-and-forget by design — an audit-log write failure must never block
// or fail the admin action it's recording. Call this AFTER the real
// mutation has already succeeded.
export async function logAdminAction(params: {
  action: string;
  targetType: string;
  targetId: string;
  performedById: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        performedById: params.performedById,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error('[auditLogService] Failed to write audit log entry:', params.action, err);
  }
}
