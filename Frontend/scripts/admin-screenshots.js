#!/usr/bin/env node
// Local QA helper: screenshots admin pages in Georgian as SUPER_ADMIN vs
// MANAGER against MOCKED API data (no database needed). For the MANAGER run
// the mock responses go through the same money-key rule the backend applies
// (Backend/src/middleware/moneyVisibility.ts), so the pictures show what a
// non-super admin really gets.
//
//   node scripts/admin-screenshots.js http://localhost:3107 ./admin-screenshots
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:3107';
const outDir = path.resolve(process.argv[3] || 'admin-screenshots');
fs.mkdirSync(outDir, { recursive: true });

// Mirror of the backend word list (keep in sync with moneyVisibility.ts).
const MONEY = new Set(('price prices pricing amount amounts revenue revenues income profit earning earnings earned payout payouts balance balances ' +
  'commission commissions fee fees tetri cents gel usd eur currency budget salary wage hourly cost costs spend spent gross net refund refunds refunded ' +
  'discount discounted sale sales sold escrow payment payments transaction transactions invoice invoices bog stripe wallet volume gmv mrr arr money paid').split(' '));
const ALLOWED = new Set(['isPaid', 'paidAt', 'isFree']);
const words = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[\s_\-.]+/).filter(Boolean).map((w) => w.toLowerCase());
const isMoney = (k) => !ALLOWED.has(k) && words(k).some((w) => MONEY.has(w));
const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !isMoney(k)).map(([k, x]) => [k, strip(x)])) : v;

const now = new Date().toISOString();
const day = (d) => new Date(Date.now() + d * 86400000).toISOString();
const person = (n, e) => ({ id: e, name: n, email: `${e}@example.com` });
const product = (id, title, price, status) => ({
  id, title, description: 'პროდუქტის მოკლე აღწერა.', titleEn: title, descriptionEn: 'Short description.', status, category: 'შაბლონები',
  price, currentPrice: price, discountedPrice: null, saleActive: false, saleStartsAt: null, saleEndsAt: null, salesCount: 12,
  downloadsCount: 34, licenseType: 'PERSONAL_USE', imageUrl: 'https://placehold.co/160x120/png', previewImages: [], previewVideoUrl: null,
  fileUrl: 'https://example.com/f.zip', fileName: 'file.zip', additionalFiles: [], toolRoute: null, howItWorksSteps: null,
  submittedBy: person('ნინო ბერიძე', 'nino'), rejectionReason: null, aiReviewedAt: null, createdAt: now,
});

const MOCKS = {
  '/auth/me': null, // filled per role
  '/admin-panel/sidebar-badges': { businessVerifications: 2, pendingMentorApplications: 1, newCourseEnrollments: 3, pendingCourseReviews: 1, newLiveTrainingLeads: 0, pendingProducts: 2, waitlistEntries: 0, studioInquiries: 1, highSeverityChatFlags: 0, reportedForumPosts: 1 },
  '/admin-panel/dashboard-stats': {
    users: { total: 1240, pendingApproval: 4, banned: 3, students: 980, clients: 210 },
    gigs: { total: 86, active: 14, byStatus: {} }, vacancies: { total: 31, byStatus: {} },
    volume: { totalGrossAmount: 4523000, totalCommissionAmount: 452300, totalNetAmount: 4070700, transactionCount: 318 },
    disputes: { open: 2 }, payouts: { pending: 5 },
    examProctoring: { total: 140, inProgress: 3, completed: 130, flagged: 7, flaggedLast7Days: 2 },
  },
  '/admin/mentorship/queue': { data: [] },
  '/admin/mentorship/requests': { data: [] },
  '/admin/mentorship/mentors': { data: [{ id: 'm1', userId: 'm1', name: 'გიორგი კაპანაძე', email: 'giorgi@example.com', mentorTitle: 'UX დიზაინერი', mentorTitleEn: 'UX Designer', mentorHourlyRate: 8000, mentorSkills: ['Figma'], mentorLanguages: ['ქართული'], bio: '', bioEn: '', mentorPublished: true, avatarUrl: null, cvUrl: null }] },
  '/admin/mentorship/mentors/m1/availability': { data: [{ id: 'r1', mentorId: 'm1', dayOfWeek: 1, startTime: '18:00', endTime: '21:00' }] },
  '/admin/mentorship/bookings': { data: [
    { id: 'b1', scheduledAt: day(2), studentPhone: '', consultationDescription: null, googleMeetLink: 'https://meet.google.com/x', calendarSyncError: null, recordingUrl: null, recordingUploadedAt: null, createdAt: now,
      mentor: person('გიორგი კაპანაძე', 'giorgi'), student: person('ანა ლომიძე', 'ana'), sessionStatus: 'COMPLETED', bogPayment: { status: 'COMPLETED', amount: 8000, currency: 'GEL' },
      netAmount: 6800, escrowStatus: 'HELD_IN_ESCROW', disputeRaisedAt: null, disputeReason: null, disputeResolvedAt: null, disputeResolution: null },
    { id: 'b2', scheduledAt: day(-3), studentPhone: '', consultationDescription: null, googleMeetLink: null, calendarSyncError: null, recordingUrl: null, recordingUploadedAt: null, createdAt: now,
      mentor: person('გიორგი კაპანაძე', 'giorgi'), student: person('დავით ჯაში', 'davit'), sessionStatus: 'PENDING', bogPayment: { status: 'PENDING', amount: 8000, currency: 'GEL' },
      netAmount: null, escrowStatus: null, disputeRaisedAt: null, disputeReason: null, disputeResolvedAt: null, disputeResolution: null },
  ] },
  '/admin/products': { data: [product('p1', 'Canva შაბლონების ნაკრები', 2900, 'PENDING'), product('p2', 'AI პრომპტების წიგნი', 1500, 'PENDING')] },
  '/admin-panel/ai-automation-settings': { data: { productAutoApproveMinScore: 80, productAutoApproveMinConfidence: 80 } },
  '/admin/finance/course-payments': { data: [
    { id: 'pay1', gateway: 'BOG', bogOrderId: 'BOG-10023', user: person('ანა ლომიძე', 'ana'), purpose: 'COURSE', courseId: 'c1', courseTitle: 'UI/UX დიზაინი', amount: 49000, currency: 'GEL', status: 'COMPLETED', createdAt: now, completedAt: now, refundedAmount: 0 },
  ], totalCount: 1, page: 1, pageSize: 25 },
  '/admin/finance/billing-settings': { data: { iban: '', bankName: '', recipientName: '' } },
};

async function shoot(role) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const user = { id: 'admin', name: role === 'SUPER_ADMIN' ? 'სუპერ ადმინი' : 'მენეჯერი', email: `${role.toLowerCase()}@example.com`, role: 'Student', adminRole: role, status: 'APPROVED', termsAcceptedAt: now, emailVerified: true };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname.replace(/^.*?\/api/, '');
    let body = key === '/auth/me' ? { user } : MOCKS[key] ?? { data: [] };
    if (role !== 'SUPER_ADMIN') body = strip(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.addInitScript(([u]) => {
    localStorage.setItem('cdc_access_token', 'mock-token');
    localStorage.setItem('cdc_user', JSON.stringify(u));
    localStorage.setItem('cdc_admin_lang', 'ka');
  }, [user]);
  for (const [name, url] of [['dashboard', '/admin'], ['mentorship', '/admin/mentorship'], ['products', '/admin/products'], ['finance', '/admin/finance']]) {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const file = path.join(outDir, `${role.toLowerCase()}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, '->', page.url());
  }
  await browser.close();
}

(async () => {
  await shoot('SUPER_ADMIN');
  await shoot('MANAGER');
})().catch((e) => { console.error(e); process.exit(1); });
