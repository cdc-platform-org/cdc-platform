// Must be the first import: patches Express's router so rejected promises in
// async route handlers reach errorHandler below instead of crashing the process.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
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
import reviewRoutes from './routes/reviews';
import directOfferRoutes from './routes/directOffers';
import messageRoutes from './routes/messages';
import cronRoutes from './routes/cron';
import billingRoutes from './routes/billing';
import paymentRoutes from './routes/payments';
import forumRoutes from './routes/forum';
import adminForumRoutes from './routes/adminForum';
import adminFinanceRoutes from './routes/adminFinance';
import adminAnalyticsRoutes from './routes/adminAnalytics';
import adminPayoutsRoutes from './routes/adminPayouts';
import adminDisputesRoutes from './routes/adminDisputes';
import adminMentorshipRoutes from './routes/adminMentorship';
import adminMessagesRoutes from './routes/adminMessages';
import { errorHandler } from './middleware/errorHandler';
import { PORT } from './utils/env';
import { autoApproveOverdueGigs } from './services/gigApprovalService';
import { cleanupExpiredDeletedAccounts } from './services/accountCleanupService';

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
app.use(cors());
app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/gigs', gigsRoutes);
app.use('/api/vacancies', vacanciesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-panel', adminPanelRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/direct-offers', directOfferRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/admin/forum', adminForumRoutes);
app.use('/api/admin/finance', adminFinanceRoutes);
app.use('/api/admin/finance/payouts', adminPayoutsRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/disputes', adminDisputesRoutes);
app.use('/api/admin/mentorship', adminMentorshipRoutes);
app.use('/api/admin/messages', adminMessagesRoutes);

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
