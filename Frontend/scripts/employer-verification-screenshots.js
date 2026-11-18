#!/usr/bin/env node
// Local QA helper (mocked API, no database): screenshots, in Georgian, of
//   1) an unverified employer submitting a vacancy -> the employer
//      verification modal (server 403 EMPLOYER_VERIFICATION_REQUIRED),
//   2) the /employer-verification page,
//   3) the single admin review queue (companies + individuals).
//
//   node scripts/employer-verification-screenshots.js http://localhost:3108 ./out
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://localhost:3108';
const outDir = path.resolve(process.argv[3] || 'employer-verification-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const now = new Date().toISOString();

const gateBody = {
  message: 'Account verification is required before you can publish a listing.',
  messageKa: 'ვაკანსიის, შეკვეთის ან ფასიანი შეთავაზების გამოსაქვეყნებლად საჭიროა დამსაქმებლის ვერიფიკაცია.',
  code: 'EMPLOYER_VERIFICATION_REQUIRED',
  verifyUrl: '/employer-verification',
};
const company = (id, name, status) => ({
  id, name: 'ნიკა ბერიძე', email: `${id}@example.com`, companyName: name, industry: 'IT', websiteUrl: null, companyDescription: null, avatarUrl: null,
  phone: null, taxId: '405123456', verificationDocUrl: 'cdcblob://doc', isVerified: status === 'APPROVED', verificationStatus: status,
  trialStartDate: null, aiTrialEndsAt: null, aiSubscriptionActive: false, createdAt: now, businessKycExtractedData: null, businessKycScore: 86,
  businessKycReasoning: null, businessKycCheckedAt: now, businessKycRejectionReason: null,
});
const individual = (id, name, status) => ({ id, name, email: `${id}@example.com`, role: 'Client', nationalId: '01001012345', verificationDocUrl: 'cdcblob://id', verificationLevel: 'INDIVIDUAL', verificationStatus: status, createdAt: now });

function mockFor(user) {
  return async (route) => {
    const req = route.request();
    const key = new URL(req.url()).pathname.replace(/^.*?\/api/, '');
    if (key === '/auth/me') return route.fulfill({ json: { user } });
    if (key === '/vacancies' && req.method() === 'POST') return route.fulfill({ status: 403, json: gateBody });
    if (key === '/admin/companies') return route.fulfill({ json: { data: [company('c1', 'შპს ციფრული სახლი', 'PENDING'), company('c2', 'შპს მარკეტ ჯგუფი', 'PENDING')] } });
    if (key === '/admin/individual-verifications') return route.fulfill({ json: { data: [individual('i1', 'ანა ლომიძე', 'PENDING')] } });
    return route.fulfill({ json: { data: [] } });
  };
}

async function withPage(user, fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/api/**', mockFor(user));
  await page.addInitScript(([u]) => {
    localStorage.setItem('cdc_access_token', 'mock-token');
    localStorage.setItem('cdc_user', JSON.stringify(u));
    localStorage.setItem('cdc_admin_lang', 'ka');
    localStorage.setItem('cdc-cookie-consent', 'declined');
  }, [user]);
  try { await fn(page); } finally { await browser.close(); }
}

const baseUser = { id: 'u1', role: 'Client', status: 'APPROVED', emailVerified: true, termsAcceptedAt: now, isVerifiedGraduate: false, isVerified: false, verificationLevel: 'NONE', verificationStatus: 'UNVERIFIED' };

(async () => {
  // 1) gated vacancy flow
  await withPage({ ...baseUser, name: 'ნიკა', email: 'nika@example.com' }, async (page) => {
    await page.goto(`${base}/ka/vacancies/post`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // Only the posting form (the header also has a search <form>).
    const form = page.locator('form:has(button[type="submit"])').last();
    for (const el of await form.locator('input:visible, textarea:visible, select:visible').elementHandles()) {
      const tag = await el.evaluate((n) => n.tagName.toLowerCase());
      const type = (await el.getAttribute('type')) || '';
      if (tag === 'select') {
        const values = await el.$$eval('option', (os) => os.map((o) => o.value).filter(Boolean));
        if (values.length) await el.selectOption(values.includes('design') ? 'design' : values[0]);
      } else if (type === 'number') await el.fill('1500');
      else if (type === 'date') await el.fill('2026-12-31');
      else if (type === 'checkbox' || type === 'radio' || type === 'file') continue;
      else await el.fill(tag === 'textarea' ? 'ვეძებთ UI/UX დიზაინერს სრულ განაკვეთზე, თბილისის ოფისში.' : 'UI/UX დიზაინერი, Figma');
    }
    // The description is a rich-text editor: type into it like a user.
    const editor = form.locator('textarea, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('ვეძებთ UI/UX დიზაინერს სრულ განაკვეთზე, თბილისის ოფისში.');
    // A floating banner can overlap the button; submit the form directly.
    await form.locator('button[type="submit"]').evaluate((b) => b.click());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'ka-vacancy-post-gated.png'), fullPage: false });
  });

  // 2) /employer-verification page
  await withPage({ ...baseUser, name: 'ნიკა', email: 'nika@example.com' }, async (page) => {
    await page.goto(`${base}/ka/employer-verification`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'ka-employer-verification-page.png'), fullPage: true });
  });

  // 3) admin queue
  await withPage({ ...baseUser, role: 'Student', name: 'სუპერ ადმინი', email: 'admin@example.com', adminRole: 'SUPER_ADMIN' }, async (page) => {
    await page.goto(`${base}/admin/companies`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, 'ka-admin-employer-verification-queue.png'), fullPage: true });
  });
  console.log('saved to', outDir);
})().catch((e) => { console.error(e); process.exit(1); });
