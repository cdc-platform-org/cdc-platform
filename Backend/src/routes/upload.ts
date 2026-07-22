import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  UserDelegationKey,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { AZURE_STORAGE_ACCOUNT_URL, AZURE_STORAGE_CONTAINER_NAME } from '../utils/env';
import { authenticate } from '../middleware/auth';
import { shouldCompress, compressVideoBuffer } from '../services/videoCompressionService';

const router = express.Router();

const SAS_EXPIRY_MINUTES = 15;
// User delegation keys can live up to 7 days; refreshing hourly keeps the blast
// radius small if one ever leaked, without hitting the Get User Delegation Key
// API on every single request.
const DELEGATION_KEY_VALIDITY_HOURS = 1;
const DELEGATION_KEY_REFRESH_MARGIN_MS = 5 * 60 * 1000;
// Clock skew between this process and Azure's clock — back-date SAS validity
// slightly so a token isn't rejected as "not yet valid" the instant it's issued.
const CLOCK_SKEW_MARGIN_MS = 5 * 60 * 1000;
// video-<timestamp>-<uuid>.<ext>, exactly what the upload handler below generates.
const BLOB_NAME_PATTERN = /^video-\d+-[0-9a-f-]{36}\.[a-zA-Z0-9]+$/;

// DefaultAzureCredential resolves to the App Service's Managed Identity automatically
// when running in Azure. Locally it falls back to `az login` (Azure CLI) or explicit
// AZURE_CLIENT_ID/AZURE_CLIENT_SECRET/AZURE_TENANT_ID env vars. No shared key or
// connection string anywhere in this file.
const credential = new DefaultAzureCredential();
const blobServiceClient = new BlobServiceClient(AZURE_STORAGE_ACCOUNT_URL, credential);
const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
// No `access` option => private container. No anonymous/public reads; every read
// goes through a short-lived, delegation-key-signed SAS URL minted below.
const containerReady = containerClient.createIfNotExists();
// Without this, an unreachable/unauthorized storage account at boot rejects this
// promise before any request awaits it, which crashes the whole process (unhandled
// rejection) instead of just this route. Request handlers below still `await
// containerReady` and see the same rejection, so per-request error handling is
// unaffected.
containerReady.catch(() => {});

let cachedDelegationKey: { key: UserDelegationKey; expiresOn: Date } | null = null;

async function getDelegationKey(): Promise<UserDelegationKey> {
  const now = Date.now();
  if (cachedDelegationKey && cachedDelegationKey.expiresOn.getTime() - now > DELEGATION_KEY_REFRESH_MARGIN_MS) {
    return cachedDelegationKey.key;
  }
  const startsOn = new Date(now - CLOCK_SKEW_MARGIN_MS);
  const expiresOn = new Date(now + DELEGATION_KEY_VALIDITY_HOURS * 60 * 60 * 1000);
  const key = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
  cachedDelegationKey = { key, expiresOn };
  return key;
}

async function sasUrlFor(blobName: string): Promise<string> {
  const delegationKey = await getDelegationKey();
  const now = Date.now();
  const sas = generateBlobSASQueryParameters(
    {
      containerName: AZURE_STORAGE_CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(now - CLOCK_SKEW_MARGIN_MS),
      expiresOn: new Date(now + SAS_EXPIRY_MINUTES * 60 * 1000),
    },
    delegationKey,
    blobServiceClient.accountName
  ).toString();
  return `${containerClient.getBlockBlobClient(blobName).url}?${sas}`;
}

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
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(compressed, {
      blobHTTPHeaders: { blobContentType: mimetype },
    });
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
    await containerReady;
    const blobName = `video-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    res.status(201).json({
      success: true,
      blob_name: blobName,
      // Only valid for SAS_EXPIRY_MINUTES — store blob_name for later access,
      // not this URL. Re-fetch via GET /video/:blobName when playback is needed.
      video_url: await sasUrlFor(blobName),
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
    await containerReady;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    if (!(await blockBlobClient.exists())) {
      return res.status(404).json({ error: 'ვიდეო ვერ მოიძებნა.' });
    }
    res.json({ video_url: await sasUrlFor(blobName) });
  } catch (err) {
    res.status(502).json({ error: 'ვერ მოხერხდა ვიდეოზე წვდომის მიღება.' });
  }
});

export default router;
