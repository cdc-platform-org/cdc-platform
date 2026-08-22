import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import { createAgentSchema, updateAgentSchema, knowledgeDocumentSchema } from '../schemas/agentSchemas';
import { parseDocumentToMarkdown, chunkMarkdown, DocumentParseError } from '../services/documentParserService';

const router = Router();
// CDC Business AI is a Business (Client) feature — every route here is
// scoped to the caller's own agents, so plain ownership checks (not just
// the role gate) guard every :id route below, same posture as gigs.ts/
// vacancies.ts's requireGigOwnerOrAdmin pattern.
router.use(authenticate, requireApproved, requireRole('Client', 'SuperAdmin'));

const TRIAL_PERIOD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

declare global {
  namespace Express {
    interface Request {
      agent?: NonNullable<Awaited<ReturnType<typeof prisma.agent.findUnique>>>;
    }
  }
}

async function loadOwnedAgent(req: Request, res: Response, next: NextFunction) {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });
  const isOwner = agent.businessId === req.user!.id;
  const isAdmin = req.user!.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(404).json({ message: 'Agent not found.' });
  req.agent = agent;
  next();
}

router.get('/', async (req: Request, res: Response) => {
  const agents = await prisma.agent.findMany({
    where: { businessId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: agents });
});

router.post('/', async (req: Request, res: Response) => {
  const result = createAgentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const agent = await prisma.agent.create({
    data: {
      ...result.data,
      businessId: req.user!.id,
      trialEndsAt: new Date(Date.now() + TRIAL_PERIOD_MS),
    },
  });
  res.status(201).json({ data: agent });
});

router.get('/:id', loadOwnedAgent, async (req: Request, res: Response) => {
  res.json({ data: req.agent });
});

router.put('/:id', loadOwnedAgent, async (req: Request, res: Response) => {
  const result = updateAgentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const agent = await prisma.agent.update({ where: { id: req.agent!.id }, data: result.data });
  res.json({ data: agent });
});

router.delete('/:id', loadOwnedAgent, async (req: Request, res: Response) => {
  await prisma.agent.delete({ where: { id: req.agent!.id } });
  res.status(204).send();
});

// --- Knowledge base ---

router.get('/:id/knowledge', loadOwnedAgent, async (req: Request, res: Response) => {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { agentId: req.agent!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: documents });
});

router.post('/:id/knowledge', loadOwnedAgent, async (req: Request, res: Response) => {
  const result = knowledgeDocumentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const doc = await prisma.knowledgeDocument.create({ data: { ...result.data, agentId: req.agent!.id } });
  res.status(201).json({ data: doc });
});

router.put('/:id/knowledge/:docId', loadOwnedAgent, async (req: Request, res: Response) => {
  const result = knowledgeDocumentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const doc = await prisma.knowledgeDocument
    .update({ where: { id: req.params.docId, agentId: req.agent!.id }, data: result.data })
    .catch(() => null);
  if (!doc) return res.status(404).json({ message: 'Knowledge document not found.' });
  res.json({ data: doc });
});

router.delete('/:id/knowledge/:docId', loadOwnedAgent, async (req: Request, res: Response) => {
  const doc = await prisma.knowledgeDocument.findFirst({ where: { id: req.params.docId, agentId: req.agent!.id } });
  if (!doc) return res.status(404).json({ message: 'Knowledge document not found.' });
  await prisma.knowledgeDocument.delete({ where: { id: doc.id } });
  res.status(204).send();
});

// File-based knowledge upload — parses PDF/DOCX/MD to Markdown (same
// services/documentParserService.ts used by the platform's own CDC
// assistant knowledge base) and chunks it into one KnowledgeDocument row
// per chunk, tagged via `question` with the source filename + part number
// so the existing text-only knowledge list (question/content) can display
// where each chunk came from without a schema change.
const knowledgeUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedExt = /\.(pdf|docx|md|txt)$/i;
    if (allowedExt.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, or Markdown (.md) files are allowed.'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
  '/:id/knowledge/upload',
  loadOwnedAgent,
  (req: Request, res: Response, next) => {
    knowledgeUpload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File exceeds the 20MB limit.' });
      }
      return res.status(400).json({ message: err.message || 'Only PDF, DOCX, or Markdown (.md) files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });

    let markdown: string;
    try {
      markdown = await parseDocumentToMarkdown(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      const message = err instanceof DocumentParseError ? err.message : 'Failed to parse this document.';
      return res.status(400).json({ message });
    }

    const chunks = chunkMarkdown(markdown);
    const docs = await Promise.all(
      chunks.map((content, i) =>
        prisma.knowledgeDocument.create({
          data: {
            agentId: req.agent!.id,
            question: chunks.length > 1 ? `📄 ${req.file!.originalname} (${i + 1}/${chunks.length})` : `📄 ${req.file!.originalname}`,
            content,
          },
        })
      )
    );
    res.status(201).json({ data: docs });
  }
);

// --- Analytics preview: recent conversations ---

router.get('/:id/conversations', loadOwnedAgent, async (req: Request, res: Response) => {
  const conversations = await prisma.agentConversation.findMany({
    where: { agentId: req.agent!.id },
    // Most recent 200 messages per conversation, not the oldest — Prisma's
    // nested include has no "last N" ordering, so fetch newest-first/take
    // then flip back to chronological order for display.
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 200 } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const data = conversations.map((c) => ({ ...c, messages: [...c.messages].reverse() }));
  res.json({ data });
});

export default router;
