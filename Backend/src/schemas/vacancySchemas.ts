import { z } from 'zod';
import { jobCategorySchema } from './gigSchemas';

const vacancyFieldsSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters.').max(150),
  description: z.string().trim().min(20, 'Description must be at least 20 characters.').max(5000),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
  location: z.string().trim().min(1, 'Location is required.'),
  skillsRequired: z.array(z.string().trim().min(1)).min(1, 'At least one skill is required.'),
  category: jobCategorySchema.nullable().optional(),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  currency: z.string().length(3).toUpperCase().nullable().optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
});
const salaryRangeRefinement = (data: { salaryMin?: number | null; salaryMax?: number | null }) =>
  !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax;

export const postVacancySchema = vacancyFieldsSchema
  .extend({
    // Creating a posting requires the full work-scope/conditions set —
    // category, salary range, currency, and a deadline are all optional on
    // vacancyFieldsSchema (shared with updateVacancySchema's partial edits)
    // but required here at creation time.
    category: jobCategorySchema,
    salaryMin: z.number().int().positive(),
    salaryMax: z.number().int().positive(),
    currency: z.string().length(3).toUpperCase(),
    applicationDeadline: z.string().datetime(),
    // Defaults to 'open' (unchanged behavior) when omitted — 'draft' lets an
    // employer save a posting before it's ready to accept applications.
    status: z.enum(['open', 'draft']).optional(),
  })
  .refine(salaryRangeRefinement, {
    message: 'Maximum salary must be greater than or equal to minimum salary.',
    path: ['salaryMax'],
  });

// All fields optional (a partial edit only sends what changed), plus status
// transitions an owner can make themselves — 'filled' is set automatically
// elsewhere in the hiring flow, not something to hand-set here.
export const updateVacancySchema = vacancyFieldsSchema
  .partial()
  .extend({
    status: z.enum(['open', 'closed', 'draft']).optional(),
  })
  .refine(salaryRangeRefinement, {
    message: 'Maximum salary must be greater than or equal to minimum salary.',
    path: ['salaryMax'],
  });

export const applyToVacancySchema = z.object({
  coverNote: z.string().trim().min(10, 'Cover note must be at least 10 characters.').max(3000),
});
export const reviewVacancyApplicationSchema = z.object({
  // 'reviewed' is shown as "Shortlisted" in the UI — a middle state between
  // the initial 'submitted' and a final accept/reject decision.
  decision: z.enum(['reviewed', 'accepted', 'rejected']),
});
