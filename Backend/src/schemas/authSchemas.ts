import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // Public registration only ever grants Student or Client — Mentor and
  // SuperAdmin have no self-serve path (Mentor has no registration flow at
  // all yet; SuperAdmin only via SUPER_ADMIN_EMAILS or the seed script).
  role: z.enum(['Student', 'Client']).optional().default('Student'),
  // Which onboarding path the student picked in register.tsx's Step 1 —
  // purely descriptive (see PrimaryIntent's schema comment), doesn't
  // affect `role` validation/derivation above.
  primaryIntent: z.enum(['TALENT', 'EMPLOYER']).optional(),
  // Server-side re-check, not just a UI-disabled-submit-button gate — the
  // frontend checkbox is required to submit, but this must still reject a
  // direct API call that skips it. z.literal(true) rejects false/missing.
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms & Conditions to register.' }) }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// Requires ONE of: the user's current password, or the literal text "DELETE"
// — matches the two confirmation methods offered in the frontend modal.
export const deleteAccountSchema = z
  .object({
    password: z.string().min(1).optional(),
    confirmText: z.string().optional(),
  })
  .refine((data) => !!data.password || data.confirmText === 'DELETE', {
    message: 'Provide your current password or type DELETE to confirm.',
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  // Only used when this Google identity is creating a brand-new account —
  // ignored (existing role kept) if the account already exists.
  role: z.enum(['Student', 'Client']).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  // Which language to render the reset email in — sent by the frontend
  // based on the current site locale (see services/emailService.ts).
  lang: z.enum(['ka', 'en']).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// Legal identity fields, self-reported under /dashboard/settings — used
// wherever the person's real name/bank details matter (certificates,
// payout requests), separate from the display `name`.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(300).optional().nullable(),
  legalFirstNameKa: z.string().trim().max(100).optional().nullable(),
  legalLastNameKa: z.string().trim().max(100).optional().nullable(),
  legalFirstNameEn: z.string().trim().max(100).optional().nullable(),
  legalLastNameEn: z.string().trim().max(100).optional().nullable(),
  nationalId: z.string().trim().max(50).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  payoutIban: z
    .union([z.string().trim().toUpperCase().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, 'Enter a valid IBAN.'), z.literal('')])
    .optional()
    .nullable(),
  // Business/employer profile — only meaningful for role Client, but not
  // schema-restricted to it (same posture as the legal-identity fields).
  companyName: z.string().trim().max(200).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  // Scheme restricted to http(s) — this gets rendered as a clickable link
  // on the company's public-facing surfaces, so a javascript:/data: URI
  // must never be storable here.
  websiteUrl: z
    .union([
      z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Website URL must start with http:// or https://'),
      z.literal(''),
    ])
    .optional()
    .nullable(),
  companyDescription: z.string().trim().max(2000).optional().nullable(),
  // Digits only (spaces/dashes stripped by the frontend before submit) —
  // compared against the AI-parsed KYC document's identification code for
  // auto-verification, see services/businessKycService.ts.
  taxId: z.string().trim().max(30).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});