import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // Public registration only ever grants Student or Client — Mentor and
  // SuperAdmin have no self-serve path (Mentor has no registration flow at
  // all yet; SuperAdmin only via SUPER_ADMIN_EMAILS or the seed script).
  role: z.enum(['Student', 'Client']).optional().default('Student'),
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
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});