import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../middleware/rateLimit';
import { chatRequestSchema } from '../schemas/agentSchemas';
import { generateAgentReply, isBusinessAiChatConfigured, BusinessAiChatError, ChatTurn } from '../services/businessAiChatService';
import { recordAgentUsage } from '../services/billingService';

const router = Router();

// Public, unauthenticated, called directly from third-party sites via
// widget.js — this is the whole reason allowedOrigins/CORS validation and
// rate limiting exist below; there's no logged-in user to hold accountable.
const chatRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many messages sent. Please try again shortly.',
});

// Recent turns included as chat history on every request — bounds the
// prompt size for a long-running conversation without losing the context
// that actually matters (the last few exchanges).
const HISTORY_TURN_LIMIT = 12;

// Starter Plan limit — see Frontend's data/productOverviews.ts for the
// exact copy shown to admins. Counted from AgentMessage rows (role
// ASSISTANT — one per real LLM reply this agent has actually generated)
// within the current calendar month, not a separate resettable counter
// column, same "derive from real rows, never drift" posture as this
// codebase's other usage checks (e.g. englishTutorQuotaService.ts).
const MONTHLY_MESSAGE_LIMIT = 2000;

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Caps how many knowledge-base documents get concatenated into the system
// instruction on every single chat turn — without this, a business that
// keeps adding KB entries makes every request larger (and more expensive)
// forever, unbounded by conversation length the way history is above.
const KNOWLEDGE_DOC_LIMIT = 40;

// Public — widget.js calls this before the visitor sends a first message,
// to render the bubble with the agent's own name/color. Deliberately
// returns only cosmetic fields — systemPrompt/knowledgeDocuments/
// allowedOrigins never leave the server.
router.get('/agents/:agentId/config', async (req: Request, res: Response) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.agentId },
    select: { id: true, name: true, primaryColor: true, status: true, trialEndsAt: true, allowedOrigins: true },
  });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  const origin = req.headers.origin;
  if (!origin || !agent.allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: 'This origin is not authorized to use this agent.' });
  }

  const trialExpired = agent.status === 'TRIAL' && agent.trialEndsAt.getTime() <= Date.now();
  res.json({
    id: agent.id,
    name: agent.name,
    primaryColor: agent.primaryColor,
    available: agent.status !== 'PAUSED' && !trialExpired,
  });
});

router.post('/chat', chatRateLimit, async (req: Request, res: Response) => {
  if (!isBusinessAiChatConfigured()) {
    return res.status(501).json({ message: 'CDC Business AI is not configured on this server.' });
  }

  const result = chatRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { agentId, message, conversationId, visitorRef } = result.data;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return res.status(404).json({ message: 'Agent not found.' });

  // CORS origin validation — the actual security boundary (the app's own
  // global cors() middleware is permissive by design for the rest of the
  // API; this route enforces its own allow-list against the agent's
  // configured origins instead of trusting the browser alone).
  const origin = req.headers.origin;
  if (!origin || !agent.allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: 'This origin is not authorized to use this agent.' });
  }

  // Subscription/trial guard — never auto-charges anything here, just
  // decides whether to answer. PAUSED is set explicitly (by the business,
  // or by the trial-expiry cron, see services/agentBillingService.ts).
  const trialExpired = agent.status === 'TRIAL' && agent.trialEndsAt.getTime() <= Date.now();
  if (agent.status === 'PAUSED' || trialExpired) {
    // No LLM call is made — this is the actual "reject the completion
    // request" enforcement, before any usage/cost is incurred. `reason`
    // lets a business's own dashboard (or a future widget state) tell a
    // trial lapsing apart from an admin explicitly pausing the agent,
    // rather than only having the same generic message for both.
    return res.json({
      conversationId: conversationId ?? null,
      reply: 'This assistant is temporarily unavailable. Please try again later or contact us directly.',
      unavailable: true,
      reason: trialExpired ? 'TRIAL_EXPIRED' : 'PAUSED',
    });
  }

  // Starter Plan monthly message cap — same "reject before any LLM call is
  // made" posture as the trial/paused guard above, so a business over its
  // limit never incurs cost on requests that will be rejected anyway.
  const messagesThisMonth = await prisma.agentMessage.count({
    where: { role: 'ASSISTANT', createdAt: { gte: startOfCurrentMonth() }, conversation: { agentId: agent.id } },
  });
  if (messagesThisMonth >= MONTHLY_MESSAGE_LIMIT) {
    return res.json({
      conversationId: conversationId ?? null,
      reply: 'This assistant has reached its monthly message limit. Please contact us to upgrade your plan.',
      unavailable: true,
      reason: 'MESSAGE_LIMIT_REACHED',
    });
  }

  let conversation = conversationId
    ? await prisma.agentConversation.findFirst({ where: { id: conversationId, agentId: agent.id } })
    : null;
  if (!conversation) {
    conversation = await prisma.agentConversation.create({ data: { agentId: agent.id, visitorRef } });
  }

  const priorMessages = await prisma.agentMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_TURN_LIMIT,
  });
  const history: ChatTurn[] = priorMessages.reverse().map((m) => ({ role: m.role, content: m.content }));

  const knowledgeDocs = await prisma.knowledgeDocument.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
    take: KNOWLEDGE_DOC_LIMIT,
  });
  const knowledgeContext = knowledgeDocs
    .map((doc) => (doc.question ? `Q: ${doc.question}\nA: ${doc.content}` : doc.content))
    .join('\n\n');

  await prisma.agentMessage.create({ data: { conversationId: conversation.id, role: 'USER', content: message } });

  let reply: string;
  let usage: { promptTokens: number; completionTokens: number } | undefined;
  try {
    const result = await generateAgentReply({
      systemPrompt: agent.systemPrompt,
      knowledgeContext,
      history,
      message,
    });
    reply = result.reply;
    usage = result.usage;
  } catch (err) {
    const errMessage = err instanceof BusinessAiChatError ? err.message : 'Unexpected error generating a reply.';
    console.error('[chatApi] generateAgentReply failed:', errMessage);
    return res.status(502).json({
      conversationId: conversation.id,
      reply: agent.fallbackPhone
        ? `Sorry, I'm having trouble responding right now. Please call us at ${agent.fallbackPhone}.`
        : "Sorry, I'm having trouble responding right now. Please try again shortly.",
      unavailable: true,
    });
  }

  await prisma.agentMessage.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: reply } });

  // Usage Tracker — meters this execution against the agent's
  // BillingSubscription, if one exists (see billingService.recordAgentUsage's
  // own comment on why a missing subscription is a silent no-op here). Never
  // allowed to fail the request the visitor is waiting on.
  if (usage) {
    recordAgentUsage({
      businessId: agent.businessId,
      agentId: agent.id,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    }).catch((err) => console.error('[chatApi] recordAgentUsage failed:', err));
  }

  res.json({ conversationId: conversation.id, reply });
});

export default router;
