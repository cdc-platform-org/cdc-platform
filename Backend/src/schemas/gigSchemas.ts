import { z } from 'zod';

// Matches Prisma's JobCategory enum — kept here rather than imported from
// @prisma/client so this schema file has no runtime dependency on the
// generated client, same reasoning as the other hand-written enums below.
export const jobCategorySchema = z.enum(['ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other']);

// CLIENT_REQUEST ("შეკვეთა" — a client asking for a freelancer) requires a
// deadline; FREELANCER_OFFER ("მომსახურების შეთავაზება" — a freelancer
// advertising their own service) requires portfolioLinks + deliveryDays
// instead. Both share the same underlying Gig table/title/description/
// budget/category shape — see the GigOfferType comment in schema.prisma.
export const postGigSchema = z
  .object({
    title: z.string().trim().min(5, 'Title must be at least 5 characters.').max(150),
    description: z.string().trim().min(20, 'Description must be at least 20 characters.').max(5000),
    budgetType: z.enum(['fixed', 'hourly']),
    budgetAmount: z.number().int('Budget must be a whole number of minor units.').positive(),
    currency: z.string().length(3).toUpperCase(),
    skillsRequired: z.array(z.string().trim().min(1)).min(1, 'At least one skill is required.'),
    // Required at creation — see the equivalent note on postVacancySchema.
    category: jobCategorySchema,
    // Free-typed category when category === 'other' — see the field's
    // schema comment on the Gig model.
    customCategory: z.string().trim().max(80).nullable().optional(),
    offerType: z.enum(['CLIENT_REQUEST', 'FREELANCER_OFFER']).optional().default('CLIENT_REQUEST'),
    deadline: z.string().datetime().nullable().optional(),
    portfolioLinks: z.array(z.string().trim().url('Enter a valid URL.')).max(10).optional().default([]),
    deliveryDays: z.number().int('Delivery time must be a whole number of days.').positive().max(365).nullable().optional(),
  })
  .refine((data) => data.offerType !== 'CLIENT_REQUEST' || !!data.deadline, {
    message: 'A deadline is required.',
    path: ['deadline'],
  })
  .refine((data) => data.offerType !== 'FREELANCER_OFFER' || data.portfolioLinks.length > 0, {
    message: 'At least one portfolio link is required.',
    path: ['portfolioLinks'],
  })
  .refine((data) => data.offerType !== 'FREELANCER_OFFER' || !!data.deliveryDays, {
    message: 'Delivery time is required.',
    path: ['deliveryDays'],
  })
  .refine((data) => data.category !== 'other' || !!data.customCategory?.trim(), {
    message: 'Please specify the custom category.',
    path: ['customCategory'],
  });

export const applyToGigSchema = z.object({
  proposalNote: z.string().trim().min(10, 'Proposal must be at least 10 characters.').max(3000),
  bidAmount: z.number().int('Bid must be a whole number of minor units.').positive(),
  deliveryDays: z.number().int('Delivery timeframe must be a whole number of days.').positive().max(365),
});

export const submitGigWorkSchema = z.object({
  comment: z.string().trim().min(10, 'Comment must be at least 10 characters.').max(3000),
  files: z.array(z.string().url()).max(10).optional().default([]),
  links: z.array(z.string().url()).max(10).optional().default([]),
});