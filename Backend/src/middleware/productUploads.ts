import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Shared between adminProducts.ts (admin-authored catalog entries) and
// products.ts (graduate/freelancer submissions) — both need identical
// validation so a submitter and an admin can't upload different things for
// the same DigitalProduct.imageUrl/fileUrl/previewImages fields.

// Preview/cover image — same 10MB/image-only guard as course thumbnails/avatars.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Downloadable asset (UI kit, prompt pack, e-book, video demo, etc.) — broader
// allowlist than images, no code/executable formats. Extension check is the
// primary guard since exotic design-tool formats (PSD/FIG/SKETCH/AI) don't
// reliably report a standard mimetype across browsers/OSes. NOTE: like the
// rest of this codebase's Bunny-Storage-backed uploads, this returns a plain
// public CDN URL — access control for buyers-only is enforced at the API
// layer (products.ts's /:id/download only reveals fileUrl to a verified
// purchaser), not by the storage URL itself being unguessable.
const ALLOWED_FILE_MIMETYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/pdf',
  'application/epub+zip',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
  'image/vnd.adobe.photoshop',
  'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const ALLOWED_FILE_EXTENSIONS = /\.(zip|pdf|epub|rar|7z|fig|sketch|psd|ai|docx|doc|mp4|mov)$/i;

const fileUploadFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_FILE_MIMETYPES.includes(file.mimetype) || ALLOWED_FILE_EXTENSIONS.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only ZIP, PDF, EPUB, RAR, 7Z, FIG, SKETCH, PSD, AI, DOCX, MP4, or MOV files are allowed.'));
  }
};

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileUploadFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — product assets/short demo videos
});

export function multerErrorHandler(req: Request, res: Response, err: any, next: NextFunction) {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is too large.' });
  }
  return res.status(400).json({ message: err.message || 'Upload rejected.' });
}
