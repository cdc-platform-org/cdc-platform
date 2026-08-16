import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

const router = Router();

const agentWithSources = {
  include: { knowledgeSources: { select: { sourceFilename: true } } },
} as const;

function serializeAgent(agent: { knowledgeSources: { sourceFilename: string }[] } & Record<string, unknown>) {
  const { knowledgeSources, ...rest } = agent;
  return { ...rest, knowledgeSourceFilenames: knowledgeSources.map((s) => s.sourceFilename) };
}

// Public — mirrors routes/adminKnowledge.ts's own public GET: pages/api/chat.ts
// fetches this at request time to decide which persona/knowledge scope
// drives the CDC homepage assistant. Returns null (not 404) when no agent is
// currently set as the homepage default, which the Frontend reads as "use
// the existing hardcoded behavior unchanged" — see lib/gemini.ts and
// lib/cdcKnowledgeBase.ts.
router.get('/homepage-config', async (_req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findFirst({
    where: { isDefault: true, isActive: true },
    include: { knowledgeSources: { select: { sourceFilename: true } } },
  });
  if (!agent) return res.json({ data: null });
  res.json({
    data: {
      systemPrompt: agent.systemPrompt,
      knowledgeSourceFilenames: agent.knowledgeSources.map((s) => s.sourceFilename),
    },
  });
});

router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (_req: Request, res: Response) => {
  const agents = await prisma.platformAgent.findMany({
    orderBy: { createdAt: 'asc' },
    ...agentWithSources,
  });
  res.json({ data: agents.map(serializeAgent) });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, nameEn, slug, systemPrompt } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'name is required.' });
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ message: 'slug is required and must be lowercase letters, numbers, and hyphens only.' });
  }
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    return res.status(400).json({ message: 'systemPrompt is required.' });
  }
  const existing = await prisma.platformAgent.findUnique({ where: { slug } });
  if (existing) return res.status(400).json({ message: 'An agent with this slug already exists.' });

  const agent = await prisma.platformAgent.create({
    data: { name: name.trim(), nameEn: typeof nameEn === 'string' ? nameEn.trim() || null : null, slug, systemPrompt: systemPrompt.trim() },
    ...agentWithSources,
  });
  await logAdminAction({ action: 'ai-agents.create', targetType: 'PlatformAgent', targetId: agent.id, performedById: req.user!.id });
  res.status(201).json({ data: serializeAgent(agent) });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  const { name, nameEn, systemPrompt, isActive } = req.body ?? {};
  const data: { name?: string; nameEn?: string | null; systemPrompt?: string; isActive?: boolean } = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'name cannot be empty.' });
    data.name = name.trim();
  }
  if (nameEn !== undefined) data.nameEn = typeof nameEn === 'string' ? nameEn.trim() || null : null;
  if (systemPrompt !== undefined) {
    if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) return res.status(400).json({ message: 'systemPrompt cannot be empty.' });
    data.systemPrompt = systemPrompt.trim();
  }
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean.' });
    // Deactivating the current homepage-default agent would silently leave
    // the homepage with no active default — force the admin to explicitly
    // reassign the default first (same posture as the delete guard below).
    if (isActive === false && agent.isDefault) {
      return res.status(400).json({ message: 'This agent is the current homepage default. Set a different default before deactivating it.' });
    }
    data.isActive = isActive;
  }

  const updated = await prisma.platformAgent.update({ where: { id: agent.id }, data, ...agentWithSources });
  await logAdminAction({ action: 'ai-agents.update', targetType: 'PlatformAgent', targetId: agent.id, performedById: req.user!.id, metadata: data });
  res.json({ data: serializeAgent(updated) });
});

// Narrower than the general update above — SUPER_ADMIN only, mirrors
// adminMentorship.ts's posture on /mentors/promote: which persona actually
// answers the live homepage assistant is more consequential than editing an
// agent's own name/prompt/active flag.
router.post('/:id/set-default', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });
  if (!agent.isActive) return res.status(400).json({ message: 'Activate this agent before setting it as the homepage default.' });
  if (agent.isDefault) return res.status(400).json({ message: 'This agent is already the homepage default.' });

  await prisma.$transaction([
    prisma.platformAgent.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.platformAgent.update({ where: { id: agent.id }, data: { isDefault: true } }),
  ]);
  await logAdminAction({ action: 'ai-agents.set-default', targetType: 'PlatformAgent', targetId: agent.id, performedById: req.user!.id });
  const updated = await prisma.platformAgent.findUniqueOrThrow({ where: { id: agent.id }, ...agentWithSources });
  res.json({ data: serializeAgent(updated) });
});

// Clears the homepage default without picking a replacement — reverts the
// live homepage assistant to its original hardcoded prompt/full knowledge
// base (see homepage-config's null-response contract above).
router.post('/:id/unset-default', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });
  if (!agent.isDefault) return res.status(400).json({ message: 'This agent is not the homepage default.' });

  const updated = await prisma.platformAgent.update({ where: { id: agent.id }, data: { isDefault: false }, ...agentWithSources });
  await logAdminAction({ action: 'ai-agents.unset-default', targetType: 'PlatformAgent', targetId: agent.id, performedById: req.user!.id });
  res.json({ data: serializeAgent(updated) });
});

// Replaces the agent's full assigned-knowledge-source set in one call —
// matches how the admin UI's multi-select checklist naturally posts "here's
// the complete desired set" rather than incremental add/remove calls.
// sourceFilename isn't validated against CdcKnowledgeDocument here: an
// admin unchecking a source and then deleting the underlying document (or
// vice versa) in either order should never be a race that 404s this call.
router.put('/:id/knowledge-sources', async (req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  const { sourceFilenames } = req.body ?? {};
  if (!Array.isArray(sourceFilenames) || sourceFilenames.some((f) => typeof f !== 'string')) {
    return res.status(400).json({ message: 'sourceFilenames must be an array of strings.' });
  }
  const unique = [...new Set(sourceFilenames as string[])];

  await prisma.$transaction([
    prisma.platformAgentKnowledgeSource.deleteMany({ where: { platformAgentId: agent.id } }),
    prisma.platformAgentKnowledgeSource.createMany({
      data: unique.map((sourceFilename) => ({ platformAgentId: agent.id, sourceFilename })),
    }),
  ]);
  await logAdminAction({
    action: 'ai-agents.set-knowledge-sources',
    targetType: 'PlatformAgent',
    targetId: agent.id,
    performedById: req.user!.id,
    metadata: { sourceFilenames: unique },
  });
  const updated = await prisma.platformAgent.findUniqueOrThrow({ where: { id: agent.id }, ...agentWithSources });
  res.json({ data: serializeAgent(updated) });
});

router.delete('/:id', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const agent = await prisma.platformAgent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });
  if (agent.isDefault) {
    return res.status(400).json({ message: 'This agent is the current homepage default. Set a different default (or unset it) before deleting.' });
  }

  await prisma.platformAgent.delete({ where: { id: agent.id } });
  await logAdminAction({ action: 'ai-agents.delete', targetType: 'PlatformAgent', targetId: agent.id, performedById: req.user!.id });
  res.status(204).send();
});

export default router;
