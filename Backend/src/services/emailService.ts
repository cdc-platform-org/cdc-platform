import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM, SUPER_ADMIN_EMAILS, BACKEND_URL } from '../utils/env';
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
