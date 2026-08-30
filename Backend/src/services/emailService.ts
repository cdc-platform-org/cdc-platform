import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM, SUPER_ADMIN_EMAILS, HR_SUPPORT_NOTIFICATION_EMAILS, BACKEND_URL } from '../utils/env';
import { buildMentorshipIcs } from './icsService';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// BACKEND_URL isn't guaranteed https:// (see its own comment in utils/env.ts)
// — same class of bug as payments.ts's callback URL, coerced the same way,
// so a certificate download link never gets printed into an email as
// http://localhost:4000/... in production.
function httpsBackendUrl(): string {
  return BACKEND_URL.startsWith('https://') ? BACKEND_URL : `https://${BACKEND_URL.replace(/^https?:\/\//, '')}`;
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function wrapTemplate(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:linear-gradient(135deg,#06b6d4,#7c3aed);padding:24px 32px;">
                <span style="color:#ffffff;font-weight:900;font-size:18px;letter-spacing:0.05em;">CDC</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h1>
                <div style="font-size:14px;line-height:1.6;color:#475569;">${bodyHtml}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                  <tr>
                    <td style="border-radius:10px;background:linear-gradient(135deg,#06b6d4,#2563eb);">
                      <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:24px;font-size:12px;color:#94a3b8;word-break:break-all;">${ctaUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">CDC — Center for Digital Careers</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string, devFallbackLink: string): Promise<void> {
  if (!resend) {
    // No RESEND_API_KEY configured — this stands in for actually sending
    // mail (same pattern as the pre-existing dev-mode verification email),
    // so the flow is fully testable end-to-end without a real provider.
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject} | Link: ${devFallbackLink}`);
    return;
  }
  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  } catch (err) {
    // Never let an email provider outage break the request that triggered
    // it (registration, password reset) — log and fall back to the console
    // link so the flow is still recoverable by reading server logs.
    console.error(`[emailService] Resend send failed for ${to}:`, err);
    console.log(`[DEV EMAIL FALLBACK] To: ${to} | Subject: ${subject} | Link: ${devFallbackLink}`);
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${FRONTEND_URL}/auth/verify-email?token=${token}`;
  const html = wrapTemplate(
    'დაადასტურეთ თქვენი ელ-ფოსტა',
    'გმადლობთ CDC-ზე რეგისტრაციისთვის! დააჭირეთ ქვემოთ მოცემულ ღილაკს ანგარიშის დასადასტურებლად. ბმული ვალიდურია 24 საათის განმავლობაში.',
    'ელ-ფოსტის დადასტურება',
    link
  );
  await sendEmail(email, 'დაადასტურეთ თქვენი CDC ანგარიში', html, link);
}

export async function sendVacancyApplicationEmail(
  employerEmail: string,
  applicantName: string,
  vacancyTitle: string,
  applicantId: string
): Promise<void> {
  const link = `${FRONTEND_URL}/messages/${applicantId}`;
  const html = wrapTemplate(
    'ახალი განაცხადი ვაკანსიაზე',
    `<strong>${applicantName}</strong>-მა გამოგიგზავნათ განაცხადი თქვენს ვაკანსიაზე „${vacancyTitle}“. დააჭირეთ ქვემოთ მოცემულ ღილაკს, რომ ნახოთ მისი შეტყობინება და დაუკავშირდეთ პირდაპირ პლატფორმაზე.`,
    'შეტყობინების ნახვა',
    link
  );
  await sendEmail(employerEmail, `ახალი განაცხადი: ${vacancyTitle}`, html, link);
}

export async function sendStudioInquiryEmail(
  inquiryId: string,
  name: string,
  email: string,
  projectType: string
): Promise<void> {
  if (SUPER_ADMIN_EMAILS.length === 0) {
    // No admin recipients configured — same posture as an unconfigured
    // Resend key: log so the inquiry is still discoverable, don't throw.
    console.log(`[DEV EMAIL] No SUPER_ADMIN_EMAILS configured — new studio inquiry ${inquiryId} from ${email} not emailed.`);
    return;
  }
  const link = `${FRONTEND_URL}/admin/studio`;
  const html = wrapTemplate(
    'New CDC Studio Inquiry',
    `<strong>${name}</strong> (${email}) submitted a new project inquiry — type: <strong>${projectType}</strong>. Review it in the admin panel.`,
    'View Inquiry',
    link
  );
  await Promise.all(
    SUPER_ADMIN_EMAILS.map((adminEmail) => sendEmail(adminEmail, `New Studio Inquiry: ${projectType}`, html, link))
  );
}

// Fired from routes/payments.ts's HR_SUPPORT callback branch once payment
// completes and escrow is captured — recipients come from
// HR_SUPPORT_NOTIFICATION_EMAILS (utils/env.ts), not hardcoded here, so
// changing who gets alerted is a config change, not a deploy.
export async function sendHRSupportRequestAlertEmail(params: {
  requestId: string;
  vacancyTitle: string;
  employerName: string;
  employerEmail: string;
  candidateCount: number;
  grossAmount: number;
  currency: string;
}): Promise<void> {
  if (HR_SUPPORT_NOTIFICATION_EMAILS.length === 0) {
    console.log(`[DEV EMAIL] No HR_SUPPORT_NOTIFICATION_EMAILS configured — HR request ${params.requestId} not emailed.`);
    return;
  }
  const link = `${FRONTEND_URL}/admin/hr-requests`;
  const amount = (params.grossAmount / 100).toFixed(2);
  const html = wrapTemplate(
    'New HR Assistance Request',
    `<strong>${params.employerName}</strong> (${params.employerEmail}) paid for HR screening on their vacancy „${params.vacancyTitle}“ — <strong>${params.candidateCount} candidate(s)</strong>, <strong>${amount} ${params.currency}</strong>. Assign a specialist in the admin portal.`,
    'Open HR Requests',
    link
  );
  await Promise.all(
    HR_SUPPORT_NOTIFICATION_EMAILS.map((adminEmail) => sendEmail(adminEmail, `New HR Assistance Request: ${params.vacancyTitle}`, html, link))
  );
}

export async function sendCyberSentinelWaitlistEmail(entryId: string, name: string, email: string, os: string): Promise<void> {
  if (SUPER_ADMIN_EMAILS.length === 0) {
    console.log(`[DEV EMAIL] No SUPER_ADMIN_EMAILS configured — new Cyber Sentinel waitlist entry ${entryId} from ${email} not emailed.`);
    return;
  }
  const link = `${FRONTEND_URL}/admin/cyber-sentinel`;
  const html = wrapTemplate(
    'New Cyber Sentinel Waitlist Signup',
    `<strong>${name}</strong> (${email}) joined the Cyber Sentinel AI early-access waitlist — preferred OS: <strong>${os}</strong>.`,
    'View Waitlist',
    link
  );
  await Promise.all(SUPER_ADMIN_EMAILS.map((adminEmail) => sendEmail(adminEmail, 'New Cyber Sentinel Waitlist Signup', html, link)));
}

// Certificates are sent as a real attachment, not a link — bypasses
// sendEmail()'s HTML-only helper since Resend's attachments param needs the
// PDF buffer passed alongside the message. Same log-only fallback when
// Resend isn't configured, so the flow stays testable without a real key.
export async function sendCertificateEmail(
  to: string,
  studentName: string,
  courseTitle: string,
  pdfBuffer: Buffer,
  filename: string,
  verificationCode: string,
  lang: 'ka' | 'en' = 'ka'
): Promise<void> {
  const subject = lang === 'en' ? 'Your Certificate - CDC' : 'თქვენი სერტიფიკატი - CDC';
  // Public, no-login download of the exact same PDF that's attached — see
  // GET /api/courses/certificates/download/:code (routes/courses.ts).
  const downloadUrl = `${httpsBackendUrl()}/api/courses/certificates/download/${verificationCode}`;
  const html = wrapTemplate(
    lang === 'en' ? 'Your Certificate is Ready' : 'თქვენი სერტიფიკატი მზადაა',
    lang === 'en'
      ? `Congratulations, ${studentName}! Your certificate for completing <strong>${courseTitle}</strong> is attached to this email — you can also download it anytime using the button below.`
      : `გილოცავთ, ${studentName}! თქვენი სერტიფიკატი კურსის „<strong>${courseTitle}</strong>“ დასრულებისთვის თანდართულია ამ წერილს — ასევე შეგიძლიათ ჩამოტვირთოთ ქვემოთ მოცემული ღილაკით ნებისმიერ დროს.`,
    lang === 'en' ? 'Download Certificate' : 'სერტიფიკატის ჩამოტვირთვა',
    downloadUrl
  );
  if (!resend) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject} | Certificate PDF attached (${pdfBuffer.length} bytes, not actually sent)`);
    return;
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      attachments: [{ filename, content: pdfBuffer }],
    });
  } catch (err) {
    console.error(`[emailService] Certificate email failed for ${to}:`, err);
    throw err;
  }
}

// Fired once per completed mentorship booking (routes/payments.ts's BOG
// callback, MENTORSHIP branch) — after the Google Calendar event has been
// attempted, success or failure. `meetLink` is null when calendar sync
// failed/isn't configured; every email still sends, just without a Meet
// link line, per the "never let a calendar hiccup silently drop the
// confirmation" requirement. Each recipient's send is independently
// try/caught so one bad address can't suppress the other two.
export interface MentorshipBookingEmailParams {
  bookingId: string;
  mentorName: string;
  mentorEmail: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetLink: string | null;
  consultationDescription: string | null;
}

export async function sendMentorshipBookingEmails(params: MentorshipBookingEmailParams): Promise<void> {
  const {
    bookingId,
    mentorName,
    mentorEmail,
    studentName,
    studentEmail,
    studentPhone,
    scheduledAt,
    durationMinutes,
    meetLink,
    consultationDescription,
  } = params;

  const whenStr = scheduledAt.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi', dateStyle: 'full', timeStyle: 'short' });
  const topicLine = consultationDescription ? `<p><strong>თემა:</strong> ${consultationDescription}</p>` : '';
  const meetLine = meetLink
    ? `<p><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>`
    : '<p>Google Meet ბმული ავტომატურად დაემატება მალე — შეამოწმეთ პირადი კაბინეტი.</p>';
  const sessionsUrl = `${FRONTEND_URL}/dashboard/mentorship-sessions`;

  // Mentor — plain HTML, no attachment.
  const mentorHtml = wrapTemplate(
    'ახალი მენტორის სესია დაჯავშნილია',
    `<strong>${studentName}</strong>-მა დაჯავშნა სესია — <strong>${whenStr}</strong>.${topicLine}<p><strong>ტელეფონი:</strong> ${studentPhone}</p>${meetLine}`,
    'პირადი კაბინეტის ნახვა',
    sessionsUrl
  );
  await sendEmail(mentorEmail, `ახალი დაჯავშნა: ${studentName}`, mentorHtml, sessionsUrl);

  // CDC Center/admin — reuses the same "notify the team" recipient list as
  // sendStudioInquiryEmail, no-op (logged) if none configured.
  if (SUPER_ADMIN_EMAILS.length > 0) {
    const adminHtml = wrapTemplate(
      'ახალი მენტორის დაჯავშნა (გადახდილი)',
      `<strong>${studentName}</strong> ↔ <strong>${mentorName}</strong> — <strong>${whenStr}</strong>.${topicLine}${meetLine}`,
      'ადმინ პანელის ნახვა',
      `${FRONTEND_URL}/admin/mentorship`
    );
    await Promise.all(
      SUPER_ADMIN_EMAILS.map((adminEmail) =>
        sendEmail(adminEmail, `ახალი მენტორის სესია: ${studentName} ↔ ${mentorName}`, adminHtml, sessionsUrl)
      )
    );
  } else {
    console.log(`[emailService] No SUPER_ADMIN_EMAILS configured — mentorship booking ${bookingId} not emailed to admin.`);
  }

  // Student — with an .ics calendar invite attached, same
  // attachments-bypass-sendEmail() shape as sendCertificateEmail, but never
  // throws (a booking confirmation must never fail the payment callback
  // that triggers it).
  const studentHtml = wrapTemplate(
    'თქვენი მენტორის სესია დადასტურებულია',
    `თქვენი სესია მენტორთან <strong>${mentorName}</strong> დაჯავშნილია — <strong>${whenStr}</strong>.${topicLine}${meetLine}<p>კალენდარში დასამატებლად გახსენით თანდართული ფაილი.</p>`,
    'პირადი კაბინეტის ნახვა',
    sessionsUrl
  );
  if (!resend) {
    console.log(`[DEV EMAIL] To: ${studentEmail} | Subject: მენტორის სესია დადასტურებულია | Meet: ${meetLink ?? '(pending)'}`);
    return;
  }
  try {
    const ics = buildMentorshipIcs({
      bookingId,
      mentorName,
      studentName,
      scheduledAt,
      durationMinutes,
      meetLink,
      consultationDescription,
    });
    await resend.emails.send({
      from: EMAIL_FROM,
      to: studentEmail,
      subject: 'თქვენი მენტორის სესია დადასტურებულია',
      html: studentHtml,
      attachments: [{ filename: 'mentorship-session.ics', content: Buffer.from(ics, 'utf-8') }],
    });
  } catch (err) {
    console.error(`[emailService] Mentorship confirmation email failed for ${studentEmail}:`, err);
  }
}

// Fired once, the first time a booking's recordingUrl is set (see
// services/mentorshipRecordingService.ts) — never re-sent on a later edit
// of an already-attached link. The CTA button links straight to the
// external recording URL itself (Google Drive / Bunny / direct MP4 —
// whatever the admin/mentor pasted), not back into the CDC dashboard.
export async function sendRecordingReadyEmail(params: {
  studentEmail: string;
  studentName: string;
  mentorName: string;
  scheduledAt: Date;
  recordingUrl: string;
  consultationDescription: string | null;
}): Promise<void> {
  const { studentEmail, studentName, mentorName, scheduledAt, recordingUrl, consultationDescription } = params;
  const whenStr = scheduledAt.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi', dateStyle: 'full', timeStyle: 'short' });
  const topicLine = consultationDescription ? `<p><strong>თემა:</strong> ${consultationDescription}</p>` : '';
  const html = wrapTemplate(
    'თქვენი მენტორობის სესიის ჩანაწერი მზადაა! 🎥',
    `გამარჯობა, ${studentName}! თქვენი სესია მენტორთან <strong>${mentorName}</strong> — <strong>${whenStr}</strong> — ჩაწერილია და უკვე ხელმისაწვდომია ყურებისთვის.${topicLine}`,
    'ჩანაწერის ყურება',
    recordingUrl
  );
  await sendEmail(studentEmail, 'თქვენი მენტორობის სესიის ჩანაწერი მზადაა! 🎥', html, recordingUrl);
}

// Fired once, the moment a Business account's public registry extract is
// approved (routes/adminCompanies.ts's setVerified) — the same trigger
// point that starts the 7-day AI Agents Suite trial, so this email is what
// tells the business that trial is now live.
export async function sendBusinessVerifiedEmail(email: string, companyName: string): Promise<void> {
  const link = `${FRONTEND_URL}/dashboard/ai-tools`;
  const html = wrapTemplate(
    'თქვენი ბიზნეს ანგარიში დადასტურდა! ✅',
    `გილოცავთ! <strong>${companyName || 'თქვენი კომპანია'}</strong>-ს საჯარო რეესტრის ამონაწერი დადასტურდა ადმინისტრაციის მიერ. ` +
      `AI ინსტრუმენტები და 7-დღიანი უფასო საცდელი პერიოდი უკვე გააქტიურებულია თქვენი ანგარიშისთვის.`,
    'AI ინსტრუმენტების გახსნა',
    link
  );
  await sendEmail(email, 'თქვენი ბიზნეს ანგარიში დადასტურდა! ✅', html, link);
}

// Distinct from the auto-verify path's silence-on-pending: this fires only
// for an admin's explicit reject action (see routes/adminCompanies.ts),
// which is the one point in the KYC flow where a human-written reason
// actually exists. `reason` is admin-authored, not AI output — see
// businessKycReasoning on the User model for the AI's own explanation,
// which is shown in the admin drawer but never sent to the business.
export async function sendBusinessRejectedEmail(email: string, companyName: string, reason: string): Promise<void> {
  const link = `${FRONTEND_URL}/onboarding`;
  const html = wrapTemplate(
    'თქვენი ბიზნეს დოკუმენტის განხილვა ⚠️',
    `სამწუხაროდ, ვერ დავადასტურეთ <strong>${companyName || 'თქვენი კომპანიის'}</strong> რეგისტრაციის დოკუმენტი.<br><br>` +
      `მიზეზი: ${reason}<br><br>` +
      `გთხოვთ ატვირთოთ ახალი ან გასწორებული დოკუმენტი განხილვისთვის.`,
    'დოკუმენტის ხელახლა ატვირთვა',
    link
  );
  await sendEmail(email, 'თქვენი ბიზნეს დოკუმენტის განხილვა ⚠️', html, link);
}

// Fired alongside every in-app Notification row an admin creates (manual
// POST /admin/notifications, or an automated system one — see that route
// and every other prisma.notification.create call across this codebase)
// so a notification isn't missed by someone who doesn't have the site open.
// Deliberately generic ("you have an official notification") rather than
// repeating the notification's own title/message in the email body — the
// full content only ever lives on the platform, consistent with this
// system being a one-way admin -> user channel with no reply-in-app
// affordance (see NotificationBell.tsx's own comment).
export async function sendOfficialNotificationEmail(email: string): Promise<void> {
  const link = `${FRONTEND_URL}/dashboard/notifications`;
  const html = wrapTemplate(
    'თქვენ მიიღეთ ახალი შეტყობინება',
    'ადმინისტრაციისგან მიღებული გაქვთ ახალი ოფიციალური შეტყობინება. გთხოვთ გაეცნოთ მას პლატფორმაზე.' +
      '<p style="margin-top:20px;font-size:12px;color:#94a3b8;">კითხვების შემთხვევაში მოგვწერეთ პირდაპირ: info@cdc.org.ge</p>',
    'შეტყობინების ნახვა პლატფორმაზე',
    link
  );
  await sendEmail(email, 'CDC პლატფორმის შეტყობინება / Official Notification from CDC', html, link);
}

// Fired once per subscription, ~24h before BillingSubscription.trialEndsAt
// (see billingService.sweepTrialEndingWarnings) — paired with an identical
// in-app Notification. Exact wording is the platform's explicit ethical-
// billing commitment: the user is told before access could lapse, not
// after. Never re-sent for the same trial (trialWarningSentAt guards it).
export async function sendTrialEndingWarningEmail(email: string): Promise<void> {
  const link = `${FRONTEND_URL}/dashboard/billing`;
  const html = wrapTemplate(
    'თქვენი საცდელი პერიოდი მალე იწურება',
    'თქვენს საცდელ პერიოდს ვადა 1 დღეში ეწურება. წვდომის გასაგრძელებლად შეგიძლიათ გადაიხადოთ დაშბორდიდან.',
    'ბილინგის გვერდის ნახვა',
    link
  );
  await sendEmail(email, 'თქვენი საცდელი პერიოდი მალე იწურება — CDC', html, link);
}

// Fired once per billing cycle, ~24h before BillingSubscription.currentPeriodEnd
// (see billingService.sweepRenewalReminders) — only for subscriptions with
// autoRenew on and a verified card, i.e. a charge the user actually opted
// into. This is the platform's "no surprise charges" commitment in
// practice: always a heads-up before money moves, with an explicit way out
// (delete the card) named right in the message. Exact wording as specified.
export async function sendPreDebitReminderEmail(email: string): Promise<void> {
  const link = `${FRONTEND_URL}/dashboard/settings`;
  const html = wrapTemplate(
    'მოახლოებული გადახდა თქვენს ანგარიშზე',
    'თანხის ჩამოჭრის დროა. თუ გსურთ მომსახურების გაგრძელება, გთხოვთ დაახვედროთ საკმარისი თანხა ბარათზე. თუ არ გსურთ გაგრძელება, შეგიძლიათ წაშალოთ ბარათი პარამეტრებიდან.',
    'ბარათის მართვა',
    link
  );
  await sendEmail(email, 'მოახლოებული გადახდა თქვენს ანგარიშზე — CDC', html, link);
}

// Fired once per cancellation (see billingService.revokeAccessAndNotify) —
// covers both triggers, the user's own "გამოწერის გაუქმება" button and a
// removed payment method that instantly cancels the subscription it was
// funding. Paired with an identical in-app Notification.
export async function sendSubscriptionCanceledEmail(email: string, productLabel: string): Promise<void> {
  const link = `${FRONTEND_URL}/dashboard/billing`;
  const html = wrapTemplate(
    'თქვენი გამოწერა გაუქმებულია',
    `თქვენი გამოწერა <strong>${productLabel}</strong>-ზე გაუქმებულია და ულიმიტო წვდომა ამ სერვისზე შეწყდა დაუყოვნებლივ. თუ ეს შეცდომით მოხდა, შეგიძლიათ ნებისმიერ დროს ხელახლა გამოიწეროთ დაშბორდიდან.`,
    'ბილინგის გვერდის ნახვა',
    link
  );
  await sendEmail(email, 'თქვენი გამოწერა გაუქმებულია — CDC', html, link);
}

// Fired whenever PUT /auth/me actually changes User.payoutIban (see
// routes/auth.ts) — the one security-sensitive field that route lets a
// user change with nothing more than their existing session. This is the
// account owner's only real-time signal that it happened, so an account-
// takeover that quietly redirects future payouts doesn't go unnoticed
// until money is already gone. Always sent, even to the email on file for
// an account whose session was just hijacked — a legitimate change is a
// harmless extra email; an illegitimate one is the whole point of sending it.
export async function sendPayoutIbanChangedEmail(email: string): Promise<void> {
  const link = `${FRONTEND_URL}/profile/settings`;
  const html = wrapTemplate(
    'თქვენი გადახდის IBAN შეიცვალა',
    'თქვენს ანგარიშზე განახლდა თანხის გატანის საბანკო ანგარიშის ნომერი (IBAN). თუ ეს თქვენ არ გაგიკეთებიათ, დაუყოვნებლივ შეცვალეთ პაროლი და დაგვიკავშირდით.',
    'ანგარიშის პარამეტრები',
    link
  );
  await sendEmail(email, 'თქვენი გადახდის IBAN შეიცვალა — CDC', html, link);
}

// Basic HTML-escaping for AI-generated + user-edited free text landing
// inside an HTML email body — without this, transcript/notes content
// containing "<", ">", or "&" would corrupt the surrounding markup (at
// best) or inject arbitrary HTML into an email sent from CDC's own
// domain (at worst). ka+en only, same precedent as this file's other
// dashboard-feature emails (sendRecordingReadyEmail, sendRecordingReady*
// siblings) — not the full 9-locale sweep, since this is a one-off
// user-triggered export, not site-wide UI copy.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Very long AI transcripts are still useful in full, but an unbounded
// email body risks provider size limits / being clipped by the reader's
// inbox — capped generously (roughly 15-20 printed pages) with the export
// buttons on the page itself as the real way to get the complete text
// past this point.
const MEDIA_STUDIO_EMAIL_MAX_CHARS = 60_000;
function truncateForEmail(text: string, lang: 'ka' | 'en'): string {
  if (text.length <= MEDIA_STUDIO_EMAIL_MAX_CHARS) return escapeHtml(text);
  const notice = lang === 'en' ? '\n\n[Truncated — download the full text from the Media Studio page.]' : '\n\n[შემოკლებულია — სრული ტექსტი ჩამოტვირთეთ Media Studio გვერდიდან.]';
  return escapeHtml(text.slice(0, MEDIA_STUDIO_EMAIL_MAX_CHARS) + notice);
}

// "Send via Email" action on the AI Voice & Video Media Studio's
// transcript/notes editor (Frontend's MediaStudioPage) — a user-composed
// destination address, unlike every other email in this file (which target
// a fixed system-known recipient). Kept safe to expose despite that by the
// route's own authentication + tight per-user rate limit (see
// routes/mediaStudio.ts), not by restricting the recipient here.
export async function sendMediaStudioExport(params: {
  to: string;
  senderEmail: string;
  transcript?: string;
  notes?: string;
  lang?: 'ka' | 'en';
}): Promise<void> {
  const { to, senderEmail, transcript, notes, lang = 'ka' } = params;
  const link = `${FRONTEND_URL}/dashboard/tools/media-studio`;

  const sections: string[] = [];
  if (notes) {
    sections.push(
      `<h3 style="margin:24px 0 8px;font-size:15px;color:#0f172a;">${lang === 'en' ? 'Notes & Summary' : 'კონსპექტი და შეჯამება'}</h3>` +
        `<div style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#334155;">${truncateForEmail(notes, lang)}</div>`
    );
  }
  if (transcript) {
    sections.push(
      `<h3 style="margin:24px 0 8px;font-size:15px;color:#0f172a;">${lang === 'en' ? 'Full Transcript' : 'სრული ტრანსკრიპტი'}</h3>` +
        `<div style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#334155;">${truncateForEmail(transcript, lang)}</div>`
    );
  }

  const intro =
    lang === 'en'
      ? `<strong>${escapeHtml(senderEmail)}</strong> shared this from CDC's AI Voice &amp; Video Media Studio.`
      : `<strong>${escapeHtml(senderEmail)}</strong>-მა გაგიზიარათ ეს მასალა CDC-ის AI ხმოვანი და ვიდეო სტუდიიდან.`;

  const html = wrapTemplate(
    lang === 'en' ? 'AI Voice & Video Studio — Export' : 'AI ხმოვანი და ვიდეო სტუდია — ექსპორტი',
    `<p>${intro}</p>${sections.join('')}`,
    lang === 'en' ? 'Open Media Studio' : 'Media Studio-ს გახსნა',
    link
  );
  const subject = lang === 'en' ? 'AI Voice & Video Studio — shared export' : 'AI ხმოვანი და ვიდეო სტუდია — გაზიარებული მასალა';

  if (!resend) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject} | From: ${senderEmail} | (not actually sent — RESEND_API_KEY unset)`);
    return;
  }
  await resend.emails.send({ from: EMAIL_FROM, to, subject, html, replyTo: senderEmail });
}

export async function sendPasswordResetEmail(email: string, token: string, lang: 'ka' | 'en' = 'ka'): Promise<void> {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  const html =
    lang === 'en'
      ? wrapTemplate(
          'Reset Your Password',
          'We received a request to reset your CDC account password. If you did not request this, simply ignore this email — your password will remain unchanged. This link is valid for 1 hour.',
          'Reset Password',
          link
        )
      : wrapTemplate(
          'პაროლის აღდგენა',
          'მიღებულია მოთხოვნა თქვენი CDC ანგარიშის პაროლის აღდგენაზე. თუ ეს თქვენ არ მოგითხოვიათ, უბრალოდ იგნორირება გაუკეთეთ ამ წერილს — თქვენი პაროლი უცვლელი დარჩება. ბმული ვალიდურია 1 საათის განმავლობაში.',
          'პაროლის აღდგენა',
          link
        );
  const subject = lang === 'en' ? 'CDC — Password Reset' : 'CDC — პაროლის აღდგენა';
  await sendEmail(email, subject, html, link);
}
