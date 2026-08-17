import { prisma } from '../lib/prisma';

// Singleton row (same convention as bogSettings — see routes/adminPanel.ts).
// Defaults here mirror the Prisma column defaults exactly, so a caller gets
// the same values whether or not a row has ever been created (no row is
// created until an admin actually saves a change via PUT
// /admin-panel/ai-automation-settings).
const DEFAULTS = {
  autoApproveScoreThreshold: 85,
  autoApproveConfidenceThreshold: 85,
  blogAutoPublish: false,
};

export async function getAiAutomationSettings() {
  const settings = await prisma.aiAutomationSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return {
    autoApproveScoreThreshold: settings?.autoApproveScoreThreshold ?? DEFAULTS.autoApproveScoreThreshold,
    autoApproveConfidenceThreshold: settings?.autoApproveConfidenceThreshold ?? DEFAULTS.autoApproveConfidenceThreshold,
    blogAutoPublish: settings?.blogAutoPublish ?? DEFAULTS.blogAutoPublish,
  };
}
