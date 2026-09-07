import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION } from '../utils/env';
import { NotificationLocale } from '../utils/notificationLocale';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// ============================================================
// META WHATSAPP BUSINESS CLOUD API — same "degrade gracefully, never fail
// the request that triggered it" posture as emailService.ts's sendEmail:
// a business-initiated notification (registration/enrollment confirmation)
// is sent outside any customer-service session window, so Meta requires an
// approved message TEMPLATE, not a free-form text message — a plain text
// send would simply be rejected by the API for a conversation the user
// didn't start. Template names/language and the parameter values that fill
// each template's placeholders are entirely caller-supplied; this module
// only owns phone-number normalization and the actual API call.
// ============================================================

const isProduction = process.env.NODE_ENV === 'production';

// Georgian mobile numbers are commonly typed as a bare 9-digit local number
// ("511141411"), with spaces ("511 14 14 11"), with a domestic trunk "0"
// prefix, or already as a full E.164 string (with or without a leading
// "+") — the Cloud API's `to` field wants digits only, always with the
// country code, no "+". Not a general E.164 formatter (this platform's
// leads/users are Georgian phone numbers specifically, same "ka/en-only,
// not truly international" scope as this codebase's other phone-facing
// features), so an already-foreign number is left alone rather than
// guessed at.
const GEORGIA_COUNTRY_CODE = '995';

export function toE164Georgian(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith(GEORGIA_COUNTRY_CODE)) return digits;
  if (digits.startsWith('0')) return `${GEORGIA_COUNTRY_CODE}${digits.slice(1)}`;
  return `${GEORGIA_COUNTRY_CODE}${digits}`;
}

export interface SendWhatsAppMessageParams {
  to: string; // raw phone number — normalized internally via toE164Georgian
  templateName: string;
  // WhatsApp's default locale codes ('ka' isn't a real option on Meta's
  // template language list as of this API version) — 'ka' is accepted here
  // anyway since the actual approved template's language is configured on
  // Meta's side when the template is created; this just has to match it.
  languageCode?: string;
  // Filled into the template body's {{1}}, {{2}}, ... placeholders in
  // order — WhatsApp templates address parameters positionally, not by
  // name, unlike this codebase's email templates.
  textParameters: string[];
}

export function isWhatsAppConfigured(): boolean {
  return !!WHATSAPP_TOKEN && !!WHATSAPP_PHONE_NUMBER_ID;
}

export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams): Promise<void> {
  const { to, templateName, languageCode = 'ka', textParameters } = params;

  if (!isWhatsAppConfigured()) {
    console.warn(`[whatsappService] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID not configured — WhatsApp message to ${to} ("${templateName}") was NOT sent.`);
    return;
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: toE164Georgian(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: textParameters.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`WhatsApp API request failed (${response.status}): ${errorBody}`);
    }
  } catch (err) {
    // Never let a Meta API outage (or a misconfigured/unapproved template)
    // break the registration/payment flow that triggered this — same
    // reasoning as sendEmail's own catch. Only logged verbosely outside
    // production, matching sendEmail's dev-fallback posture.
    console.error(`[whatsappService] Failed to send "${templateName}" to ${to}:`, err instanceof Error ? err.message : err);
    if (!isProduction) {
      console.log(`[DEV WHATSAPP] To: ${to} | Template: ${templateName} | Params: ${JSON.stringify(textParameters)}`);
    }
  }
}

// ============================================================
// COURSE & LIVE TRAINING REGISTRATION — one unified WhatsApp template
// ("live_course_registration") covering both Courses and Live Trainings,
// at both moments a registration's payment status matters: the initial
// signup (PENDING for a paid item awaiting checkout, or PAID when nothing
// was owed / paid up front) and a later payment-status update once a
// BOG/Stripe webhook confirms payment. WhatsApp counterpart to
// emailService.ts's registration/enrollment emails and
// courseEnrollmentNotification.ts's in-app Notification, fired alongside
// (not instead of) those. `live_course_registration` must exist as a real
// Meta-approved template (Meta Business Manager) with exactly 5 body
// placeholders in this order before this can actually deliver anything;
// until then sendWhatsAppMessage's own "not configured" guard (or Meta
// rejecting an unrecognized template/placeholder-count) keeps this a safe
// no-op rather than a broken send — same posture as every other AI/
// notification integration in this codebase.
// ============================================================
// Meta requires the FULL locale tag for English ("en_US"), not the bare
// "en" this codebase otherwise uses everywhere else (resolveNotificationLocale,
// email subjects, etc.) — WhatsApp template language codes follow Meta's own
// list (https://developers.facebook.com/docs/whatsapp/business-management-api/languages),
// which is why this mapping lives here rather than in resolveNotificationLocale
// itself (that helper's 'en' is correct for every OTHER caller).
const WHATSAPP_LANGUAGE_CODE: Record<NotificationLocale, string> = { ka: 'ka', en: 'en_US' };

export type RegistrationPaymentStatus = 'PENDING' | 'PAID';

// {{4}} — a single fixed bilingual string regardless of the template's own
// selected language, per the exact wording specified for this integration
// (the surrounding template body text is still locale-branched via
// WHATSAPP_LANGUAGE_CODE above; only this one status field always shows
// both languages together).
const PAYMENT_STATUS_LABEL: Record<RegistrationPaymentStatus, string> = {
  PAID: 'დადასტურებულია / Paid',
  PENDING: 'მოლოდინშია / Pending',
};

// {{5}} default — overridable per call (e.g. once real Google Meet/
// Classroom links exist for a Live Training) so a PAID Course purchase
// (which has no Meet/Classroom concept at all) still gets a sensible note
// without every call site having to know the difference.
function defaultAccessNote(paymentStatus: RegistrationPaymentStatus, locale: NotificationLocale): string {
  if (paymentStatus === 'PENDING') {
    return locale === 'en'
      ? 'Your spot is reserved — full access unlocks automatically once your payment is confirmed.'
      : 'თქვენი ადგილი დაჯავშნილია — სრული წვდომა გააქტიურდება ავტომატურად გადახდის დადასტურების შემდეგ.';
  }
  return locale === 'en'
    ? `You're all set! Check your CDC Dashboard for access details: ${FRONTEND_URL}/dashboard`
    : `მზად ხართ! წვდომის დეტალებისთვის ეწვიეთ თქვენს CDC დაშბორდს: ${FRONTEND_URL}/dashboard`;
}

function formatWhatsAppDate(date: Date | null, locale: NotificationLocale): string {
  if (!date) return locale === 'en' ? 'to be confirmed soon' : 'დაზუსტდება მალე';
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ka-GE', { timeZone: 'Asia/Tbilisi', dateStyle: 'long' });
}

export interface SendRegistrationStatusWhatsAppParams {
  phone: string;
  firstName: string;
  // Localized Course/LiveTraining title — {{2}}.
  itemTitle: string;
  // Formatted start date/schedule text — {{3}}. Pass a pre-formatted
  // string (see formatWhatsAppDate below) rather than a raw Date so
  // callers without a real date (e.g. a rolling/on-demand course) can
  // supply their own schedule description instead.
  scheduleText: string;
  paymentStatus: RegistrationPaymentStatus;
  locale?: NotificationLocale;
  // {{5}} override — e.g. real Google Meet/Classroom links once available.
  // Defaults to a generic PENDING/PAID note (defaultAccessNote above) when
  // omitted, so simple callers (a Course purchase, which has no
  // Meet/Classroom concept) don't need to construct one themselves.
  accessNote?: string;
}

// The one function every Course/LiveTraining registration and
// payment-status-change call site should use — see this section's own
// header comment for the full trigger-point list.
export async function sendRegistrationStatusWhatsApp(params: SendRegistrationStatusWhatsAppParams): Promise<void> {
  const { phone, firstName, itemTitle, scheduleText, paymentStatus, locale = 'ka', accessNote } = params;
  await sendWhatsAppMessage({
    to: phone,
    templateName: 'live_course_registration',
    languageCode: WHATSAPP_LANGUAGE_CODE[locale],
    // Positional {{1}}..{{5}}: first name, item title, schedule, payment
    // status, access note — exact order/contract this integration was
    // specified with.
    textParameters: [firstName, itemTitle, scheduleText, PAYMENT_STATUS_LABEL[paymentStatus], accessNote ?? defaultAccessNote(paymentStatus, locale)],
  });
}

export { formatWhatsAppDate };
