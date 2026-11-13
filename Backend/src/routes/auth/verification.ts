/**
 * Identity verification uploads: business KYC documents (auto-parsed) and
 * individual ID documents, plus a signed link to view your own document.
 * Only admins can mark an account verified.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { sendBusinessVerifiedEmail } from '../../services/emailService';
import { BunnyStorageUploadError, deleteBunnyStorageUrlIfManaged } from '../../services/bunnyStorage';
import {
  uploadVerificationDoc,
  resolveVerificationDocDeliveryUrl,
  deleteVerificationDocIfManaged,
} from '../../services/verificationDocDelivery';
import {
  parseBusinessDocument,
  isBusinessKycParsingConfigured,
  shouldAutoApprove,
} from '../../services/businessKycService';
import { toUserResponse } from './shared';

const router = Router();

// Business KYC — self-serve upload of a Public Registry Extract / company
// registration document. Never sets isVerified (only an admin can, via
// routes/adminCompanies.ts) — uploading just moves the account into the
// "Under Review" state, derived on the frontend from doc-present + not-yet-verified.
const verificationDocUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, or WEBP files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Platform default when a taxId has no BusinessAccountLimit override row —
// see the model's own schema comment for the override mechanism.
const BUSINESS_TAX_ID_DEFAULT_LIMIT = 3;

router.post(
  '/me/verification-doc',
  authenticate,
  verificationDocUpload.single('document'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    const previous = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { verificationDocUrl: true, taxId: true, aiTrialEndsAt: true, companyName: true },
    });

    // Anti-fraud cap: at most N distinct accounts may verify against the
    // same Company ID (ს/კ) — counts every OTHER account already on this
    // taxId regardless of their own approval status, since the fraud risk
    // is "how many accounts registered under this code," not just how many
    // were approved. A taxId with no submitted business documents yet has
    // nothing to count against, so this only fires once the user has
    // actually set a taxId on their profile (see VerificationDrawer.tsx).
    if (previous?.taxId) {
      const [override, accountsOnThisTaxId] = await Promise.all([
        prisma.businessAccountLimit.findUnique({ where: { taxId: previous.taxId } }),
        prisma.user.count({ where: { taxId: previous.taxId, id: { not: req.user!.id } } }),
      ]);
      // maxAccounts === null on an override row means "unlimited" (an
      // explicit admin removal of the cap) — Infinity makes that branch of
      // the comparison below a no-op without a separate special case.
      const effectiveLimit = override ? override.maxAccounts ?? Infinity : BUSINESS_TAX_ID_DEFAULT_LIMIT;
      if (accountsOnThisTaxId >= effectiveLimit) {
        return res.status(409).json({ message: 'ეს ს/კ უკვე გამოყენებულია დაშვებული ექაუნთების მაქსიმალურ რაოდენობაზე.' });
      }
    }

    try {
      // Private Azure Blob storage, not the public Bunny CDN this used to
      // use — the returned `url` is a cdcblob:// marker, not a working
      // link. See verificationDocDelivery.ts for why.
      const url = await uploadVerificationDoc(req.user!.id, req.file.buffer, req.file.mimetype, req.file.originalname);

      // Best-effort instant auto-verification: only fires on a clean,
      // high-confidence match against the business's own self-reported
      // taxId (see businessKycService.ts's shouldAutoApprove) — anything
      // else (not configured, low score, non-ACTIVE status, no taxId on
      // file, a parse error) just leaves isVerified false, which is already
      // the fallback "needs manual admin review" state, so a failure here
      // never blocks the upload itself. The extracted fields are persisted
      // either way so the admin inspection drawer has something to show
      // even when auto-approval didn't fire.
      let autoVerified = false;
      let extractedData: Awaited<ReturnType<typeof parseBusinessDocument>> | null = null;
      if (isBusinessKycParsingConfigured()) {
        try {
          extractedData = await parseBusinessDocument(req.file.buffer, req.file.mimetype);
          if (previous?.taxId && shouldAutoApprove(extractedData, previous.taxId)) {
            autoVerified = true;
          }
        } catch (err) {
          console.error('[auth] Business KYC document parsing failed (falling back to manual review):', err);
        }
      }

      // A resubmission always resets isVerified unless it just auto-passed
      // — a previously-verified business swapping in a new document needs
      // a fresh look (automated or manual), not to keep riding on the old
      // document's approval.
      // Same first-time-only trial grant as routes/adminCompanies.ts's
      // setVerified() — this auto-verify path used to bypass it entirely,
      // meaning a business whose document auto-matched never got the AI
      // Agents Suite trial an admin-approved business gets.
      const isFirstTrialGrant = autoVerified && !previous?.aiTrialEndsAt;
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          verificationDocUrl: url,
          verificationLevel: 'BUSINESS',
          isVerified: autoVerified,
          verificationStatus: autoVerified ? 'APPROVED' : 'PENDING',
          businessKycRejectionReason: null,
          ...(extractedData
            ? {
                businessKycExtractedData: extractedData as unknown as Prisma.InputJsonValue,
                businessKycScore: extractedData.confidenceScore,
                businessKycReasoning: extractedData.reasoning,
                businessKycCheckedAt: new Date(),
              }
            : {}),
          ...(isFirstTrialGrant
            ? { trialStartDate: new Date(), aiTrialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            : {}),
        },
      });

      if (previous?.verificationDocUrl && previous.verificationDocUrl !== url) {
        // Each delete helper only acts on a URL that actually matches its
        // own managed shape and no-ops on anything else, so calling both
        // unconditionally correctly cleans up whichever provider the
        // replaced document actually lived on (legacy Bunny, or a prior
        // Azure-private upload) without needing to branch on it here.
        deleteBunnyStorageUrlIfManaged(previous.verificationDocUrl).catch(() => {});
        deleteVerificationDocIfManaged(previous.verificationDocUrl).catch(() => {});
      }

      if (autoVerified) {
        sendBusinessVerifiedEmail(user.email, previous?.companyName ?? '').catch((err) =>
          console.error('[auth] sendBusinessVerifiedEmail failed:', err instanceof Error ? err.message : err)
        );
        prisma.notification
          .create({
            data: {
              userId: user.id,
              title: 'თქვენი ბიზნეს ანგარიში დადასტურდა',
              message: 'AI-მ ავტომატურად დაადასტურა თქვენი დოკუმენტი — Buy/Sell წვდომა უკვე ხელმისაწვდომია.',
              type: 'BUSINESS_KYC',
            },
          })
          .catch((err) => console.error('[auth] business-kyc notification failed:', err));
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Document upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Individual identity verification — self-serve upload of an ID card/
// passport scan, the INDIVIDUAL counterpart to the BUSINESS KYC upload
// above. Unlike the business path, there's no automated-parsing/auto-
// approve heuristic for a personal ID (no equivalent of
// businessKycService.ts's taxId cross-check exists), so this always lands
// PENDING for manual admin review — see routes/adminVerifications.ts's
// verify-individual/reject-individual. Never touches isVerified/
// isVerifiedGraduate (those stay BUSINESS-only / skill-earned-only
// respectively) — an approved individual verification is read as an
// additional OR-condition alongside isVerifiedGraduate wherever freelancer
// marketplace rights are gated (gigs.ts, vacancies.ts, products.ts,
// forum.ts), not folded into either existing flag.
// 11-digit Georgian personal ID number — see the personalNumber comment on
// the User model for why this is a separate field/constraint from the
// pre-existing free-form nationalId.
const PERSONAL_NUMBER_PATTERN = /^\d{11}$/;

router.post(
  '/me/individual-verification-doc',
  authenticate,
  verificationDocUpload.single('document'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file was selected.' });
    }
    // multer parses multipart text fields into req.body alongside req.file
    // — the frontend sends this in the same request as the document itself,
    // so the anti-fraud KYC number and the ID scan it belongs to are always
    // submitted as one atomic verification act, never out of sync.
    const personalNumber = typeof req.body.personalNumber === 'string' ? req.body.personalNumber.trim() : '';
    if (!PERSONAL_NUMBER_PATTERN.test(personalNumber)) {
      return res.status(400).json({ message: 'პირადი ნომერი უნდა შედგებოდეს ზუსტად 11 ციფრისგან.' });
    }
    const existingOwner = await prisma.user.findUnique({ where: { personalNumber }, select: { id: true } });
    if (existingOwner && existingOwner.id !== req.user!.id) {
      return res.status(409).json({ message: 'ეს პირადი ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.' });
    }

    const previous = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { verificationDocUrl: true, verificationLevel: true } });

    try {
      // Private Azure Blob storage, not the public Bunny CDN this used to
      // use — see verificationDocDelivery.ts for why.
      const url = await uploadVerificationDoc(req.user!.id, req.file.buffer, req.file.mimetype, req.file.originalname);

      let user;
      try {
        user = await prisma.user.update({
          where: { id: req.user!.id },
          data: {
            verificationDocUrl: url,
            verificationLevel: 'INDIVIDUAL',
            verificationStatus: 'PENDING',
            businessKycRejectionReason: null,
            personalNumber,
          },
        });
      } catch (err: any) {
        // Defense-in-depth against a race (two requests both passing the
        // findUnique check above before either commits) — the @unique
        // constraint is the real guarantee, this just turns its violation
        // into the same clean, localized message instead of a raw 500.
        if (err.code === 'P2002') {
          deleteVerificationDocIfManaged(url).catch(() => {});
          return res.status(409).json({ message: 'ეს პირადი ნომერი უკვე გამოყენებულია სხვა ანგარიშზე.' });
        }
        throw err;
      }

      // Only delete the old file if it was itself an INDIVIDUAL-level
      // upload — never delete out from under a BUSINESS submission the
      // user might switch back to reviewing (each level keeps its own doc
      // conceptually; this reuses the single verificationDocUrl column, so
      // switching levels does mean only the most recent submission's file
      // survives, which matches "one active submission at a time" above).
      if (previous?.verificationDocUrl && previous.verificationDocUrl !== url) {
        deleteBunnyStorageUrlIfManaged(previous.verificationDocUrl).catch(() => {});
        deleteVerificationDocIfManaged(previous.verificationDocUrl).catch(() => {});
      }

      res.status(201).json({ user: toUserResponse(user) });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Document upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// Resolves the caller's OWN verificationDocUrl into something actually
// openable — a legacy Bunny row already is one and passes through
// unchanged; a new Azure-private cdcblob:// marker is not itself a URL at
// all, so the frontend's "View document" link must go through this rather
// than opening user.verificationDocUrl directly. Self-service counterpart
// to the admin resolve endpoints in adminCompanies.ts/adminVerifications.ts
// — same resolveVerificationDocDeliveryUrl(), different authorization (it's
// your own document, not an admin review).
router.get('/me/verification-doc', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { verificationDocUrl: true } });
  if (!user?.verificationDocUrl) return res.status(404).json({ message: 'No verification document on file.' });
  const url = await resolveVerificationDocDeliveryUrl(user.verificationDocUrl);
  res.json({ data: { url } });
});

export default router;
