import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM, SUPER_ADMIN_EMAILS } from '../utils/env';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

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
  lang: 'ka' | 'en' = 'ka'
): Promise<void> {
  const subject = lang === 'en' ? 'Your Certificate - CDC' : 'თქვენი სერტიფიკატი - CDC';
  const html = wrapTemplate(
    lang === 'en' ? 'Your Certificate is Ready' : 'თქვენი სერტიფიკატი მზადაა',
    lang === 'en'
      ? `Congratulations, ${studentName}! Your certificate for completing <strong>${courseTitle}</strong> is attached to this email.`
      : `გილოცავთ, ${studentName}! თქვენი სერტიფიკატი კურსის „<strong>${courseTitle}</strong>“ დასრულებისთვის თანდართულია ამ წერილს.`,
    lang === 'en' ? 'Verify Certificate' : 'სერტიფიკატის ვერიფიკაცია',
    FRONTEND_URL
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
