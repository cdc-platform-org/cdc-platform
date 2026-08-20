import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { shouldCompress, compressVideoBuffer } from '../services/videoCompressionService';
import { privateContainerReady, uploadPrivateBlob, getSignedBlobUrl, privateBlobExists } from '../services/privateBlobStorage';

const router = express.Router();

// video-<timestamp>-<uuid>.<ext>, exactly what the upload handler below generates.
const BLOB_NAME_PATTERN = /^video-\d+-[0-9a-f-]{36}\.[a-zA-Z0-9]+$/;

const videoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('მხოლოდ ვიდეო ფაილების ატვირთვაა ნებადართული!'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: videoFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Re-encodes the just-uploaded blob in place (same blob name — nothing else
// needs to change) once compression finishes. Fire-and-forget: the caller
// never awaits this, so the client already has its response with the
// original file playable immediately. If compression fails for any reason
// (ffmpeg missing, corrupt input, transient Azure error), the original blob
// is simply left as-is — this can only make a blob smaller, never break it.
async function compressAndReplaceInBackground(blobName: string, originalBuffer: Buffer, mimetype: string): Promise<void> {
  try {
    const compressed = await compressVideoBuffer(originalBuffer);
    if (compressed.length >= originalBuffer.length) {
      console.log(`[video-compression] skipped ${blobName}: compressed size was not smaller.`);
      return;
    }
    await uploadPrivateBlob(blobName, compressed, mimetype);
    console.log(
      `[video-compression] ${blobName}: ${originalBuffer.length} -> ${compressed.length} bytes ` +
        `(${Math.round((1 - compressed.length / originalBuffer.length) * 100)}% smaller)`
    );
  } catch (err) {
    console.error(`[video-compression] failed for ${blobName}, original file kept as-is:`, err);
  }
}

router.post('/video', authenticate, upload.single('video'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ფაილი არ არის არჩეული' });
  }

  try {
    await privateContainerReady;
    const blobName = `video-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    await uploadPrivateBlob(blobName, req.file.buffer, req.file.mimetype);

    res.status(201).json({
      success: true,
      blob_name: blobName,
      // Only valid for a short expiry window — store blob_name for later
      // access, not this URL. Re-fetch via GET /video/:blobName when
      // playback is needed.
      video_url: await getSignedBlobUrl(blobName),
    });

    // Runs after the response is already sent — never blocks the upload.
    if (shouldCompress(req.file.buffer)) {
      compressAndReplaceInBackground(blobName, req.file.buffer, req.file.mimetype);
    }
  } catch (err) {
    res.status(502).json({ error: 'ვიდეოს ატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.' });
  }
});

// Mints a fresh short-lived SAS URL for an already-uploaded blob. Callers persist
// blob_name (stable) rather than a video_url (expires), and hit this endpoint
// whenever they actually need to play the video.
router.get('/video/:blobName', authenticate, async (req: Request, res: Response) => {
  const { blobName } = req.params;
  if (!BLOB_NAME_PATTERN.test(blobName)) {
    return res.status(400).json({ error: 'არასწორი ფაილის სახელი.' });
  }

  try {
    await privateContainerReady;
    if (!(await privateBlobExists(blobName))) {
      return res.status(404).json({ error: 'ვიდეო ვერ მოიძებნა.' });
    }
    res.json({ video_url: await getSignedBlobUrl(blobName) });
  } catch (err) {
    res.status(502).json({ error: 'ვერ მოხერხდა ვიდეოზე წვდომის მიღება.' });
  }
});

export default router;
