import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { parseDocumentToMarkdown, chunkMarkdown, DocumentParseError } from '../services/documentParserService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedExt = /\.(pdf|docx|md|txt)$/i;
    if (allowedExt.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, or Markdown (.md) files are allowed.'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — source documents, not images
});

// Public — Frontend's pages/api/chat.ts fetches this at request time to
// build the Gemini system prompt. No auth: this is the same content the
// assistant already says out loud to any visitor, not a secret.
router.get('/', async (req: Request, res: Response) => {
  const documents = await prisma.cdcKnowledgeDocument.findMany({
    orderBy: [{ sourceFilename: 'asc' }, { chunkIndex: 'asc' }],
  });
  res.json({ data: documents });
});

router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Grouped by source file, one row per uploaded document — the admin UI's
// "list of active learned documents" view (not the raw per-chunk rows).
router.get('/sources', async (req: Request, res: Response) => {
  const documents = await prisma.cdcKnowledgeDocument.findMany({
    orderBy: [{ sourceFilename: 'asc' }, { chunkIndex: 'asc' }],
  });
  const bySource = new Map<string, { sourceFilename: string; totalChunks: number; totalChars: number; updatedAt: Date }>();
  for (const doc of documents) {
    const existing = bySource.get(doc.sourceFilename);
    if (existing) {
      existing.totalChars += doc.content.length;
      if (doc.updatedAt > existing.updatedAt) existing.updatedAt = doc.updatedAt;
    } else {
      bySource.set(doc.sourceFilename, {
        sourceFilename: doc.sourceFilename,
        totalChunks: doc.totalChunks,
        totalChars: doc.content.length,
        updatedAt: doc.updatedAt,
      });
    }
  }
  res.json({ data: Array.from(bySource.values()) });
});

// Upload (or re-sync, by uploading the same filename again) — parses the
// buffer to Markdown, chunks it, and replaces any existing chunks for that
// filename in one transaction so a re-sync never leaves stale + fresh
// chunks mixed together.
router.post(
  '/upload',
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err: any) => {
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
    const sourceFilename = req.file.originalname;

    const created = await prisma.$transaction(async (tx) => {
      await tx.cdcKnowledgeDocument.deleteMany({ where: { sourceFilename } });
      const rows = await Promise.all(
        chunks.map((content, i) =>
          tx.cdcKnowledgeDocument.create({
            data: { sourceFilename, chunkIndex: i, totalChunks: chunks.length, content },
          })
        )
      );
      return rows;
    });

    await logAdminAction({
      action: 'cdc-knowledge.upload',
      targetType: 'CdcKnowledgeDocument',
      targetId: sourceFilename,
      performedById: req.user!.id,
    });

    res.status(201).json({ data: { sourceFilename, totalChunks: chunks.length, chunks: created } });
  }
);

router.delete('/sources/:filename', async (req: Request, res: Response) => {
  const sourceFilename = decodeURIComponent(req.params.filename);
  const { count } = await prisma.cdcKnowledgeDocument.deleteMany({ where: { sourceFilename } });
  if (count === 0) return res.status(404).json({ message: 'No document found with that filename.' });

  await logAdminAction({
    action: 'cdc-knowledge.delete',
    targetType: 'CdcKnowledgeDocument',
    targetId: sourceFilename,
    performedById: req.user!.id,
  });

  res.status(204).send();
});

export default router;
