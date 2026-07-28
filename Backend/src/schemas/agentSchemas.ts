import { z } from 'zod';

const agentFieldsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a hex color like #06b6d4.').optional(),
  systemPrompt: z.string().trim().min(10, 'System prompt must be at least 10 characters.').max(4000),
  // Exact-match against the widget's request Origin header — the core of
  // POST /api/v1/chat's abuse defense, so this can't be left empty.
  allowedOrigins: z
    .array(z.string().trim().url('Each origin must be a valid URL, e.g. https://example.com').regex(/^https?:\/\//, 'Origins must start with http:// or https://'))
    .min(1, 'Add at least one allowed origin.')
    .max(20),
  fallbackPhone: z.string().trim().max(30).optional().nullable(),
});

export const createAgentSchema = agentFieldsSchema;

// status is intentionally the only field an update can touch beyond the
// base config — TRIAL is set once at creation and never hand-settable, and
// there's no ACTIVE-without-a-real-subscription path yet (see the Agent
// model's own comment on deferred billing), so the only transition a
// Business can make themselves right now is pausing/resuming.
export const updateAgentSchema = agentFieldsSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

export const knowledgeDocumentSchema = z.object({
  question: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, 'Content is required.').max(5000),
});

export const chatRequestSchema = z.object({
  agentId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  // Omit to start a new conversation — the widget then persists the
  // returned conversationId for subsequent turns.
  conversationId: z.string().uuid().optional(),
  // Client-generated visitor identifier (widget.js persists this in
  // localStorage) — required only when starting a new conversation, so a
  // returning visitor's later conversations can still be attributed to
  // the same visitorRef even across separate conversation threads.
  visitorRef: z.string().trim().min(1).max(200),
});
