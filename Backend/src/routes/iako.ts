import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { iakoChatSchema } from '../schemas/iakoSchemas';
import { askIakoAssistant, getConversation, IakoError } from '../services/iakoAssistantService';
import { isDigitalToolKey } from '../config/digitalTools';

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, or WebP screenshots are allowed.'));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 15 });

function handleUpload(req: Request, res: Response, next: (err?: unknown) => void) {
  upload.single('image')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Screenshot exceeds the 8MB limit.' });
    res.status(400).json({ message: err.message || 'Only PNG, JPEG, or WebP screenshots are allowed.' });
  });
}

async function chatHandler(resourceType: 'LIVE_TRAINING' | 'DIGITAL_TOOL', resourceId: string, req: Request, res: Response) {
  const result = iakoChatSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const image = req.file ? { buffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname } : undefined;

  try {
    const data = await askIakoAssistant({ resourceType, resourceId, userId: req.user!.id, userEmail: req.user!.email, message: result.data.message, image });
    res.json({ data });
  } catch (err) {
    if (err instanceof IakoError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
}

router.get('/live-training/:id/conversation', async (req: Request, res: Response) => {
  try {
    res.json({ data: await getConversation('LIVE_TRAINING', req.params.id, req.user!.id) });
  } catch (err) {
    if (err instanceof IakoError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});
router.post('/live-training/:id/chat', chatLimiter, handleUpload, (req: Request, res: Response) => chatHandler('LIVE_TRAINING', req.params.id, req, res));

router.get('/digital-tool/:key/conversation', async (req: Request, res: Response) => {
  if (!isDigitalToolKey(req.params.key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  try {
    res.json({ data: await getConversation('DIGITAL_TOOL', req.params.key, req.user!.id) });
  } catch (err) {
    if (err instanceof IakoError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});
router.post('/digital-tool/:key/chat', chatLimiter, handleUpload, (req: Request, res: Response) => {
  if (!isDigitalToolKey(req.params.key)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  return chatHandler('DIGITAL_TOOL', req.params.key, req, res);
});

export default router;
