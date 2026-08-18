// Must be the very first import of all — Sentry needs to patch Node's core
// modules (http, etc.) before anything else requires them. See
// instrument.ts's own comment for why this can't just be folded into the
// two lines below.
import './instrument';
// Must be the first import after that: patches Express's router so rejected
// promises in async route handlers reach errorHandler below instead of
// crashing the process.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import orderRoutes from './routes/orders';
import uploadRoutes from './routes/upload';
import gigsRoutes from './routes/gigs';
import vacanciesRoutes from './routes/vacancies';
import adminRoutes from './routes/admin';
import adminPanelRoutes from './routes/adminPanel';
import walletRoutes from './routes/wallet';
import blogRoutes from './routes/blog';
import adminBlogRoutes from './routes/adminBlog';
import reviewRoutes from './routes/reviews';
import directOfferRoutes from './routes/directOffers';
import messageRoutes from './routes/messages';
import cronRoutes from './routes/cron';
import billingRoutes from './routes/billing';
import paymentRoutes from './routes/payments';
import stripePaymentRoutes from './routes/stripePayments';
import forumRoutes from './routes/forum';
import adminForumRoutes from './routes/adminForum';
import mentorshipRoutes from './routes/mentorship';
import adminFinanceRoutes from './routes/adminFinance';
import adminAnalyticsRoutes from './routes/adminAnalytics';
import adminPayoutsRoutes from './routes/adminPayouts';
import adminDisputesRoutes from './routes/adminDisputes';
import adminExamProctoringRoutes from './routes/adminExamProctoring';
import adminMentorshipRoutes from './routes/adminMentorship';
import adminMessagesRoutes from './routes/adminMessages';
import siteContentRoutes from './routes/siteContent';
import adminCmsRoutes from './routes/adminCms';
import studioRoutes from './routes/studio';
import adminStudioRoutes from './routes/adminStudio';
import adminCompaniesRoutes from './routes/adminCompanies';
import aiRoutes from './routes/ai';
import agentsRoutes from './routes/agents';
import chatApiRoutes from './routes/chatApi';
import adminPromosRoutes from './routes/adminPromos';
import successStoriesRoutes from './routes/successStories';
import adminSuccessStoriesRoutes from './routes/adminSuccessStories';
import teamRoutes from './routes/team';
import trainersRoutes from './routes/trainers';
import adminTeamRoutes from './routes/adminTeam';
import studioCasesRoutes from './routes/studioCases';
import adminStudioCasesRoutes from './routes/adminStudioCases';
import adminKnowledgeRoutes from './routes/adminKnowledge';
import adminAiAgentsRoutes from './routes/adminAiAgents';
import cyberSentinelRoutes from './routes/cyberSentinel';
import adminCyberSentinelRoutes from './routes/adminCyberSentinel';
import freelancerExamRoutes from './routes/freelancerExam';
import skillTestsRoutes from './routes/skillTests';
import invoicesRoutes from './routes/invoices';
import notificationRoutes from './routes/notifications';
import adminNotificationRoutes from './routes/adminNotifications';
import productRoutes from './routes/products';
import adminProductRoutes from './routes/adminProducts';
import promoRoutes from './routes/promos';
import aiAgentsSuiteRoutes from './routes/aiAgentsSuite';
import examProctoringRoutes from './routes/examProctoring';
import { errorHandler } from './middleware/errorHandler';
import { PORT } from './utils/env';
import { autoApproveOverdueGigs } from './services/gigApprovalService';
import { cleanupExpiredDeletedAccounts } from './services/accountCleanupService';
import { pauseExpiredTrialAgents } from './services/agentBillingService';

// ============================================================
// PROCESS-LEVEL SAFETY NET
//
// express-async-errors (imported first, above) already catches a rejected
// promise thrown INSIDE a route handler and routes it to errorHandler below
// — that's the normal, expected path for an AI call failing mid-request,
// and every AI-calling route in this codebase already wraps its call in a
// try/catch on top of that. This net exists for what neither of those cover:
// a rejection from a fire-and-forget call (a `.then()`/`.catch()` chain
// with a bug, a promise nobody awaited) or a genuinely uncaught exception
// happening outside any request — Node's default behavior for either is to
// crash the entire process, taking down every in-flight request with it.
// Logging and continuing is the right tradeoff for THIS app specifically:
// every route already treats a missing/failed AI response as a clean
// user-facing error rather than assuming success, so a stray rejection
// elsewhere reflects a bug in one feature, not corrupted process-wide state
// that would make continuing to serve other requests unsafe.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Non-fatal — logged and ignored:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Non-fatal — logged and ignored:', err);
});

declare global {
  namespace Express {
    interface Request {
      // Raw request body bytes, needed to verify the BOG `Callback-Signature`
      // header (see routes/payments.ts) — re-serializing req.body with
      // JSON.stringify can reorder/reformat fields and break the signature.
      rawBody?: Buffer;
    }
  }
}

const app = express();
// Azure App Service terminates TLS and proxies every request through its own
// front-end — without this, req.ip resolves to that proxy's address for
// every single client, not the real caller. That silently breaks every
// IP-keyed rate limiter in this app (routes/ai.ts course tutor, chatApi.ts,
// studio.ts) into one shared bucket across all users instead of a per-user
// one, so a handful of concurrent users can exhaust it and start seeing
// legitimate first-time requests rejected. `1` trusts exactly one hop
// (Azure's own front-end), matching the actual deployment topology.
app.set('trust proxy', 1);

// Same FRONTEND_URL fallback pattern as auth.ts/payments.ts/emailService.ts,
// plus ADDITIONAL_CORS_ORIGINS for any other domain that needs to call this
// API from a browser (comma-separated, e.g. a staging preview URL) — unset
// by default. Auth is a Bearer token in the Authorization header, not a
// cookie (see Frontend's apiClient.ts), so this doesn't need `credentials`.
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL || 'https://cdc.org.ge',
    'https://cdc.org.ge',
    ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
  ]
);
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all means this isn't a browser request — a
      // server-to-server call (BOG's webhook, cron, curl) rather than
      // something CORS is meant to gate. Those still go through fine.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/gigs', gigsRoutes);
app.use('/api/vacancies', vacanciesRoutes);
app.use('/api/admin-panel', adminPanelRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin/blog', adminBlogRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/direct-offers', directOfferRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/exam-proctoring', examProctoringRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/stripe', stripePaymentRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/admin/forum', adminForumRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/admin/finance', adminFinanceRoutes);
app.use('/api/admin/finance/payouts', adminPayoutsRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/disputes', adminDisputesRoutes);
app.use('/api/admin/exam-proctoring', adminExamProctoringRoutes);
app.use('/api/admin/mentorship', adminMentorshipRoutes);
app.use('/api/admin/messages', adminMessagesRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/admin/cms', adminCmsRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/admin/studio', adminStudioRoutes);
app.use('/api/cyber-sentinel', cyberSentinelRoutes);
app.use('/api/admin/cyber-sentinel', adminCyberSentinelRoutes);
app.use('/api/admin/companies', adminCompaniesRoutes);
app.use('/api/ai', aiRoutes);
// CDC Business AI — /api/agents is the authenticated dashboard-facing CRUD
// (config, knowledge base, analytics); /api/v1/chat is the public,
// unauthenticated endpoint the embeddable widget calls directly from
// third-party sites (see routes/chatApi.ts for its own CORS/rate-limit
// posture — deliberately outside the app's normal auth model).
app.use('/api/agents', agentsRoutes);
app.use('/api/v1', chatApiRoutes);
app.use('/api/v1/success-stories', successStoriesRoutes);
app.use('/api/admin/promos', adminPromosRoutes);
app.use('/api/admin/success-stories', adminSuccessStoriesRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/trainers', trainersRoutes);
app.use('/api/admin/team', adminTeamRoutes);
app.use('/api/studio/cases', studioCasesRoutes);
app.use('/api/admin/studio/cases', adminStudioCasesRoutes);
app.use('/api/admin/knowledge', adminKnowledgeRoutes);
app.use('/api/admin/ai-agents', adminAiAgentsRoutes);
app.use('/api/freelancer-exam', freelancerExamRoutes);
app.use('/api/skill-tests', skillTestsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductRoutes);
// Deliberately last among the /api/admin/* mounts — this is the ONLY
// generically-prefixed one (all its siblings above are specific sub-paths
// like /api/admin/knowledge). Express tries mounted routers in registration
// order and this one's own router.use(authenticate, requireAdminRole(...))
// runs unconditionally for anything starting with /api/admin, so mounting
// it first would intercept every request to the more specific routers
// above — including their public, no-auth-required routes (adminKnowledge's
// GET / and adminAiAgents' GET /homepage-config, both fetched by anonymous
// homepage visitors) — before Express ever got to try them.
app.use('/api/admin', adminRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/ai-agents', aiAgentsSuiteRoutes);

const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'CDC Platform API',
    version: '1.0.0',
    description: 'Backend API for CDC Platform LMS and B2B order pipeline.',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Upload', description: 'File upload endpoints' },
  ],
  paths: {
    '/api/auth/register': { post: { tags: ['Auth'], summary: 'Register a new user', responses: { 200: { description: 'OK' } } } },
    '/api/auth/login': { post: { tags: ['Auth'], summary: 'Log in', responses: { 200: { description: 'OK' } } } },
    '/api/upload/video': {
      post: {
        tags: ['Upload'],
        summary: 'Upload a video file',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { video: { type: 'string', format: 'binary', description: 'The video file to upload' } },
                required: ['video'],
              },
            },
          },
        },
        responses: { 200: { description: 'Video uploaded successfully' } },
      },
    },
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Reports any error that reaches Express's error pipeline with status >= 500
// (Sentry's own default filter — 4xx application errors like a 404 or a
// validation 400 are expected traffic, not incidents) straight to Sentry,
// then calls next(err) so errorHandler below still builds the client
// response exactly as before. A no-op if SENTRY_DSN isn't set (see
// instrument.ts). Most routes in this app catch their own errors and
// respond directly rather than throwing (see routes/payments.ts's BOG
// callback handler for the highest-value example) — those are captured
// explicitly at the catch site instead, since they never reach here.
Sentry.setupExpressErrorHandler(app);

// Global error handler — must be registered LAST, after every route.
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CDC Platform backend running on http://localhost:${PORT}`);
});

// In-process fallback so 7-day auto-approve works out of the box on a single
// instance without needing external cron infra configured first. In a
// horizontally-scaled deployment this would fire redundantly on every
// instance — harmless here since approveGigWork() is idempotent per gig (a
// second attempt on an already-released escrow transaction just fails and is
// caught), but the real production trigger should be POST /api/cron/auto-approve
// from a single external scheduler, not this timer.
const AUTO_APPROVE_POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly
setInterval(() => {
  autoApproveOverdueGigs()
    .then(({ processedGigIds, failures }) => {
      if (processedGigIds.length > 0 || failures.length > 0) {
        console.log(
          `[auto-approve] processed=${processedGigIds.length} failures=${failures.length}`
        );
      }
    })
    .catch((err) => console.error('[auto-approve] run failed:', err));
}, AUTO_APPROVE_POLL_INTERVAL_MS);

// Same in-process-fallback caveat as above applies here: fine on a single
// instance, would run redundantly per-instance if ever scaled horizontally.
// cleanupExpiredDeletedAccounts() is idempotent (dataPurgedAt / row absence
// both make a user a no-op on the next run), so redundant runs are harmless,
// just wasted work — production should still prefer a single external
// scheduler hitting POST /api/cron/cleanup-deleted-accounts.
const ACCOUNT_CLEANUP_POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly
setInterval(() => {
  cleanupExpiredDeletedAccounts()
    .then(({ hardDeletedUserIds, anonymizedUserIds, failures }) => {
      if (hardDeletedUserIds.length > 0 || anonymizedUserIds.length > 0 || failures.length > 0) {
        console.log(
          `[account-cleanup] hardDeleted=${hardDeletedUserIds.length} anonymized=${anonymizedUserIds.length} failures=${failures.length}`
        );
      }
    })
    .catch((err) => console.error('[account-cleanup] run failed:', err));
}, ACCOUNT_CLEANUP_POLL_INTERVAL_MS);

// Same in-process-fallback caveat as above — production should prefer a
// single external scheduler hitting POST /api/cron/pause-expired-trial-agents.
// pauseExpiredTrialAgents() only ever sets status to PAUSED, never charges
// anything, so a redundant run across instances is harmless.
const AGENT_TRIAL_POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly
setInterval(() => {
  pauseExpiredTrialAgents()
    .then(({ pausedAgentIds }) => {
      if (pausedAgentIds.length > 0) {
        console.log(`[agent-trial-sweep] paused=${pausedAgentIds.length}`);
      }
    })
    .catch((err) => console.error('[agent-trial-sweep] run failed:', err));
}, AGENT_TRIAL_POLL_INTERVAL_MS);
