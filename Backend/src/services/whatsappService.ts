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
// LIVE TRAINING REGISTRATION & ENROLLMENT — WhatsApp counterparts to
// emailService.ts's sendLiveTrainingRegistrationEmail/
// sendLiveTrainingEnrollmentEmail, fired from the same call sites
// alongside (not instead of) the email. Template names below are
// placeholders — a real Meta-approved template (submitted and approved in
// Meta Business Manager, with matching {{1}}/{{2}}/... placeholder count)
// must exist under these exact names before either function can actually
// deliver anything; until then sendWhatsAppMessage's own "not configured"
// guard (or Meta rejecting an unrecognized template name) keeps this a
// safe no-op rather than a broken send.
// ============================================================
// Meta requires the FULL locale tag for English ("en_US"), not the bare
// "en" this codebase otherwise uses everywhere else (resolveNotificationLocale,
// email subjects, etc.) — WhatsApp template language codes follow Meta's own
// list (https://developers.facebook.com/docs/whatsapp/business-management-api/languages),
// which is why this mapping lives here rather than in resolveNotificationLocale
// itself (that helper's 'en' is correct for every OTHER caller).
const WHATSAPP_LANGUAGE_CODE: Record<NotificationLocale, string> = { ka: 'ka', en: 'en_US' };

const LINK_NOT_YET_ACTIVE: Record<NotificationLocale, string> = {
  ka: 'ბმული გააქტიურდება ლექციის დაწყებამდე 15 წუთით ადრე.',
  en: 'The link will activate 15 minutes before the session starts.',
};

function formatWhatsAppDate(date: Date | null, locale: NotificationLocale): string {
  if (!date) return locale === 'en' ? 'to be confirmed soon' : 'დაზუსტდება მალე';
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ka-GE', { timeZone: 'Asia/Tbilisi', dateStyle: 'long' });
}

export async function sendLiveTrainingRegistrationWhatsApp(params: {
  phone: string;
  userName: string;
  courseTitle: string;
  startDate: Date | null;
  locale?: NotificationLocale;
}): Promise<void> {
  const { phone, userName, courseTitle, startDate, locale = 'ka' } = params;
  const meetUnlockNote =
    locale === 'en'
      ? 'The Google Meet link will unlock once your enrollment (payment) is confirmed.'
      : 'Google Meet ბმული გააქტიურდება კურსზე ჩარიცხვის (გადახდის დადასტურების) შემდეგ.';
  await sendWhatsAppMessage({
    to: phone,
    templateName: 'live_course_registration',
    languageCode: WHATSAPP_LANGUAGE_CODE[locale],
    // Positional {{1}}..{{4}} — name, course title, start date, and the
    // "Meet link unlocks on enrollment" note (courseTitle repeated per the
    // template's own copy, same as the email's confirmation-line reference).
    textParameters: [userName, courseTitle, formatWhatsAppDate(startDate, locale), meetUnlockNote],
  });
}

export async function sendLiveTrainingEnrollmentWhatsApp(params: {
  phone: string;
  userName: string;
  courseTitle: string;
  meetLink: string | null;
  classroomLink: string | null;
  locale?: NotificationLocale;
}): Promise<void> {
  const { phone, userName, courseTitle, meetLink, classroomLink, locale = 'ka' } = params;
  await sendWhatsAppMessage({
    to: phone,
    templateName: 'live_course_enrollment',
    languageCode: WHATSAPP_LANGUAGE_CODE[locale],
    textParameters: [
      userName,
      courseTitle,
      meetLink || LINK_NOT_YET_ACTIVE[locale],
      classroomLink || LINK_NOT_YET_ACTIVE[locale],
      `${FRONTEND_URL}/dashboard`,
    ],
  });
}
