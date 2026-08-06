import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Fire-and-forget by design, same as auditLogService.logAdminAction — a
// logging failure must never block or fail the AI generation it's
// recording. Call this AFTER the generation attempt (success or failure)
// has already resolved.
export async function logAiGeneration(params: {
  module: string;
  status: 'success' | 'failed';
  inputContext?: Record<string, unknown>;
  outputSummary?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.aiGenerationLog.create({
      data: {
        module: params.module,
        status: params.status,
        inputContext: params.inputContext as Prisma.InputJsonValue | undefined,
        outputSummary: params.outputSummary,
        errorMessage: params.errorMessage,
      },
    });
  } catch (err) {
    console.error('[aiGenerationLogService] Failed to write AI generation log entry:', params.module, err);
  }
}
