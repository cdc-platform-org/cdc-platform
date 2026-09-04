import apiClient from './apiClient';

export type BogPaymentPurpose = 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT' | 'HR_SUPPORT' | 'LIVE_TRAINING' | 'ENGLISH_TUTOR_SUBSCRIPTION';
export type BogPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BogCheckoutResult {
  paymentId: string;
  redirectUrl: string;
}

// Course and Product checkout can each bypass BOG at 0 GEL — a 100%
// discount promo code (course only), or an admin-team account's unconditional
// free test-mode bypass (both course and product, see routes/payments.ts).
// Mentorship/gig-escrow checkout have no such bypass and keep the plain
// BogCheckoutResult above rather than every caller having to guard against a
// null that can't actually happen for them.
export interface CourseCheckoutResult {
  paymentId: string;
  // null when the 0-GEL bypass fired — enrollment is already granted
  // server-side and `enrolled` is true instead of a redirect.
  redirectUrl: string | null;
  enrolled?: boolean;
}

export interface ProductCheckoutResult {
  paymentId: string;
  // null when the admin test-mode bypass fired — the purchase is already
  // granted server-side and `purchased` is true instead of a redirect.
  redirectUrl: string | null;
  purchased?: boolean;
}

export interface BogPaymentBookingInfo {
  scheduledAt: string;
  googleMeetLink: string | null;
  calendarSyncError: string | null;
}

export interface BogPaymentStatusData {
  id: string;
  status: BogPaymentStatus;
  purpose: BogPaymentPurpose;
  referenceId: string;
  amount: number;
  currency: string;
  // Only present when purpose === 'MENTORSHIP'.
  booking: BogPaymentBookingInfo | null;
}

export async function checkoutCourse(courseId: string, promoCode?: string, lang?: 'ka' | 'en'): Promise<CourseCheckoutResult> {
  const response = await apiClient.post<CourseCheckoutResult>(`/payments/checkout/course/${courseId}`, { promoCode, lang });
  return response.data;
}

export interface PromoValidationResult {
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  originalAmount: number;
  discountedAmount: number;
}

// targetType/targetId identify what the code is being applied against — the
// backend re-checks that the code's own applicableType/applicableTargetIds
// actually cover this specific item (see couponService.ts), returning the
// exact Georgian mismatch message when it doesn't.
export type PromoTargetType = 'COURSE' | 'LIVE_TRAINING' | 'DIGITAL_PRODUCT' | 'AI_TOOL';

export async function validatePromoCode(code: string, targetType: PromoTargetType, targetId: string): Promise<PromoValidationResult> {
  const response = await apiClient.post<{ data: PromoValidationResult }>('/promos/validate', { code, targetType, targetId });
  return response.data.data;
}

export async function checkoutMentorship(params: {
  mentorId: string;
  // No amount/currency — the backend always charges the mentor's own
  // mentorHourlyRate, looked up server-side (see routes/payments.ts).
  note?: string;
  lang?: 'ka' | 'en';
  // ISO datetime string — must fall within one of the mentor's
  // MentorAvailabilityRule slots (see /admin/mentorship), re-checked
  // server-side regardless of what a booking UI displayed as available.
  scheduledAt: string;
  studentPhone: string;
  consultationDescription?: string;
}): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>('/payments/checkout/mentorship', params);
  return response.data;
}

export async function checkoutGigEscrow(gigId: string, lang?: 'ka' | 'en'): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/gig/${gigId}`, { lang });
  return response.data;
}

// GEL-only for this MVP (no Stripe path yet) — see Backend/src/routes/payments.ts's
// checkout/hr-support route.
export async function checkoutHRSupport(vacancyId: string, lang?: 'ka' | 'en'): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/hr-support/${vacancyId}`, {
    tosAccepted: true,
    lang,
  });
  return response.data;
}

export async function checkoutProduct(productId: string, promoCode?: string, lang?: 'ka' | 'en'): Promise<ProductCheckoutResult> {
  const response = await apiClient.post<ProductCheckoutResult>(`/payments/checkout/product/${productId}`, { promoCode, lang });
  return response.data;
}

export interface TutorSubscriptionCheckoutResult {
  paymentId: string;
  redirectUrl: string | null;
  enrolled?: boolean;
}

export async function checkoutEnglishTutorSubscription(lang?: 'ka' | 'en'): Promise<TutorSubscriptionCheckoutResult> {
  const response = await apiClient.post<TutorSubscriptionCheckoutResult>('/payments/checkout/english-tutor', { lang });
  return response.data;
}

export async function getBogPaymentStatus(paymentId: string): Promise<BogPaymentStatusData> {
  const response = await apiClient.get<{ data: BogPaymentStatusData }>(`/payments/bog/status/${paymentId}`);
  return response.data.data;
}

export interface MyPaymentRow {
  id: string;
  gateway: 'BOG' | 'STRIPE';
  purpose: BogPaymentPurpose;
  referenceId: string;
  // Resolved course title for COURSE purchases — null for the other two
  // purposes (mentorship's referenceId is already a free-text label; gig
  // escrow funding is already covered in full by the dashboard's Gigs tab).
  referenceTitle: string | null;
  amount: number;
  currency: string;
  status: BogPaymentStatus | 'REFUNDED';
  promoCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function getMyPayments(): Promise<MyPaymentRow[]> {
  const response = await apiClient.get<{ data: MyPaymentRow[] }>('/payments/my');
  return response.data.data;
}

export async function downloadInvoice(bogPaymentId: string): Promise<Blob> {
  const response = await apiClient.get(`/invoices/payment/${bogPaymentId}/download`, { responseType: 'blob' });
  return response.data;
}
