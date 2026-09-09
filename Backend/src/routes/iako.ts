import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { iakoChatSchema } from '../schemas/iakoSchemas';
import { askIakoAssistant, getConversation, listMyIakoAssistants, IakoError } from '../services/iakoAssistantService';
import { isDigitalToolKey } from '../config/digitalTools';

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted);

// A hard technical ceiling of 3 images per message regardless of any
// profile's configured maxScreenshotsPerMessage (which can only be <= this)
// — see product-direction section 9's "SCREENSHOTS PER MESSAGE: maximum 3".
const MAX_IMAGES_PER_MESSAGE = 3;
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, or WebP screenshots are allowed.'));
  },
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_IMAGES_PER_MESSAGE },
});

const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 15 });

function handleUpload(req: Request, res: Response, next: (err?: unknown) => void) {
  upload.array('images', MAX_IMAGES_PER_MESSAGE)(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'A screenshot exceeds the 8MB limit.' });
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ message: `You can attach at most ${MAX_IMAGES_PER_MESSAGE} screenshots per message.` });
    res.status(400).json({ message: err.message || 'Only PNG, JPEG, or WebP screenshots are allowed.' });
  });
}

async function chatHandler(resourceType: 'LIVE_TRAINING' | 'DIGITAL_TOOL', resourceId: string, req: Request, res: Response) {
  const result = iakoChatSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = files.map((file) => ({ buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname }));

  try {
    const data = await askIakoAssistant({
      resourceType, resourceId, userId: req.user!.id, userEmail: req.user!.email,
      message: result.data.message, idempotencyKey: result.data.idempotencyKey, images, topicContext: result.data.topicContext,
    });
    res.json({ data });
  } catch (err) {
    if (err instanceof IakoError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
}

router.get('/my-assistants', async (req: Request, res: Response) => {
  res.json({ data: await listMyIakoAssistants(req.user!.id, req.user!.email) });
});

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
