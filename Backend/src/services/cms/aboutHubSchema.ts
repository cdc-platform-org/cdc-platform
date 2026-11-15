import { z } from 'zod';

const copy = z.object({ ka: z.string().trim().min(1).max(4000), en: z.string().trim().min(1).max(4000) }).strict();
const optionalCopy = z.object({ ka: z.string().max(1000), en: z.string().max(1000) }).strict().refine(value => !!value.ka.trim() === !!value.en.trim(), 'Provide both Georgian and English.');
const url = z.string().max(2048).refine(value => {
  if (!value) return true;
  if (value.includes('\\') || /[\u0000-\u0020]/.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !!parsed.hostname; } catch { return false; }
}, 'Use an HTTP(S) URL or a site-relative path.');
const date = z.string().refine(value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), 'Use a valid ISO calendar date.');
const entry = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), title: copy, summary: copy,
  category: z.string().min(1).max(50), imageUrl: url, startDate: date, endDate: date,
  partners: optionalCopy, metric: optionalCopy, metricValue: z.string().max(50), url,
  isDemo: z.boolean(),
}).strict();
const entries = (categories: [string, ...string[]]) => z.array(entry.extend({ category: z.enum(categories) }).refine(value => !value.startDate || !value.endDate || value.endDate >= value.startDate, 'End date must not precede the start date.')).max(100).refine(values => new Set(values.map(value => value.id)).size === values.length, 'Entry identifiers must be unique.');

export const aboutHubSchema = z.object({
  schemaVersion: z.literal(1),
  overview: z.object({
    title: copy, intro: copy, mission: copy, vision: copy, heroImage: url,
    stats: z.array(z.object({ value: z.string().trim().min(1).max(50), label: copy, isDemo: z.boolean() }).strict()).max(6),
    team: entries(['team']), accreditations: entries(['institutional']),
  }).strict(),
  gallery: entries(['training', 'workshop', 'bootcamp', 'event']),
  projects: entries(['education', 'regional', 'grant']),
  stories: entries(['transition', 'freelance', 'employment']),
  partners: entries(['donor', 'technology', 'institutional', 'community', 'education']),
}).strict();
