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
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});