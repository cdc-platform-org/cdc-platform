import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { captureEscrow } from '../services/escrowService';
import { generateIdempotencyKey } from '../services/bogPayoutService';
import {
  GigBudgetType,
  GigStatus,
  ApplicationStatus,
  EmploymentType,
  BillingProductType,
  PaymentProvider,
  PayoutRequestStatus,
  PayoutRiskTier,
} from '@prisma/client';

// Test-only data builders for the escrow/billing integration suites. Every
// user/gig/etc. gets a random suffix so parallel test *cases* within one
// serial Jest run never collide on unique constraints (email, gigId, etc.)
// — see jest.config.js's maxWorkers: 1 for why cross-file races aren't a
// concern, this is purely about not having to hand-pick unique literals.

export async function createUser(overrides: Partial<Parameters<typeof prisma.user.create>[0]['data']> = {}) {
  const suffix = randomUUID();
  return prisma.user.create({
    data: {
      email: `test-${suffix}@cdc.test`,
      password: 'not-a-real-hash',
      name: `Test User ${suffix.slice(0, 8)}`,
      status: 'APPROVED',
      ...overrides,
    },
  });
}

// isVerifiedGraduate satisfies hasFreelancerRights() (see utils/freelancerVerification.ts)
export async function createVerifiedFreelancer() {
  return createUser({ isVerifiedGraduate: true });
}

export async function createUnverifiedFreelancer() {
  return createUser({ isVerifiedGraduate: false });
}

export async function createGig(params: {
  postedById: string;
  assignedFreelancerId?: string;
  status?: GigStatus;
  submittedAt?: Date;
}) {
  const suffix = randomUUID();
  return prisma.gig.create({
    data: {
      title: `Test gig ${suffix.slice(0, 8)}`,
      description: 'Integration test fixture gig.',
      postedById: params.postedById,
      assignedFreelancerId: params.assignedFreelancerId,
      budgetType: GigBudgetType.fixed,
      budgetAmount: 100000,
      currency: 'GEL',
      skillsRequired: [],
      status: params.status ?? GigStatus.submitted,
      submittedAt: params.submittedAt ?? new Date(),
    },
  });
}

export async function createGigApplication(params: { gigId: string; applicantId: string; bidAmount?: number }) {
  return prisma.gigApplication.create({
    data: {
      gigId: params.gigId,
      applicantId: params.applicantId,
      proposalNote: 'Integration test fixture application.',
      bidAmount: params.bidAmount ?? 100000,
      status: ApplicationStatus.accepted,
    },
  });
}

// Builds a Gig + GigApplication + captured GigTransaction (HELD_IN_ESCROW)
// in one call — the common starting state for release/refund/dispute tests.
export async function setupHeldGigEscrow(params: {
  clientId: string;
  freelancerId: string;
  grossAmount?: number;
  gigStatus?: GigStatus;
  submittedAt?: Date;
}) {
  const gig = await createGig({
    postedById: params.clientId,
    assignedFreelancerId: params.freelancerId,
    status: params.gigStatus ?? GigStatus.submitted,
    submittedAt: params.submittedAt,
  });
  const application = await createGigApplication({
    gigId: gig.id,
    applicantId: params.freelancerId,
    bidAmount: params.grossAmount ?? 100000,
  });
  const transaction = await captureEscrow({
    gigId: gig.id,
    gigApplicationId: application.id,
    clientId: params.clientId,
    freelancerId: params.freelancerId,
    grossAmount: params.grossAmount ?? 100000,
    currency: 'GEL',
    providerRef: `test-ref-${randomUUID()}`,
  });
  return { gig, application, transaction };
}

export async function createCourse(params: { instructorId?: string; originalPrice?: number }) {
  const suffix = randomUUID();
  return prisma.course.create({
    data: {
      title: `Test Course ${suffix.slice(0, 8)}`,
      description: 'Integration test fixture course.',
      category: 'Web Development',
      lessons: [],
      originalPrice: params.originalPrice ?? 10000,
      status: 'PUBLISHED',
      instructorId: params.instructorId,
    },
  });
}

export async function createDigitalProduct(params: { submittedById?: string; price?: number }) {
  const suffix = randomUUID();
  return prisma.digitalProduct.create({
    data: {
      title: `Test Product ${suffix.slice(0, 8)}`,
      description: 'Integration test fixture product.',
      price: params.price ?? 10000,
      category: 'UI Kit',
      imageUrl: 'https://example.test/image.png',
      fileUrl: 'https://example.test/file.zip',
      status: 'APPROVED',
      submittedById: params.submittedById,
    },
  });
}

export async function createVacancy(params: { postedById: string }) {
  const suffix = randomUUID();
  return prisma.vacancy.create({
    data: {
      title: `Test vacancy ${suffix.slice(0, 8)}`,
      description: 'Integration test fixture vacancy.',
      postedById: params.postedById,
      employmentType: EmploymentType.full_time,
      location: 'Tbilisi',
      skillsRequired: [],
    },
  });
}

export async function createMentorshipBooking(params: {
  mentorId: string;
  studentId: string;
  scheduledAt?: Date;
}) {
  return prisma.mentorshipBooking.create({
    data: {
      mentorId: params.mentorId,
      studentId: params.studentId,
      scheduledAt: params.scheduledAt ?? new Date(),
      studentPhone: '+995500000000',
    },
  });
}

export async function createHRSupportRequest(params: { vacancyId: string; requestedById: string }) {
  return prisma.hRSupportRequest.create({
    data: {
      vacancyId: params.vacancyId,
      requestedById: params.requestedById,
      candidateCount: 5,
      grossAmount: 20000,
      currency: 'GEL',
      tosAcceptedAt: new Date(),
    },
  });
}

export async function createVerifiedPaymentMethod(params: { userId: string; isDefault?: boolean }) {
  return prisma.paymentMethod.create({
    data: {
      userId: params.userId,
      provider: PaymentProvider.STUB,
      processorToken: `stub-tok-${randomUUID()}`,
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 3,
      isDefault: params.isDefault ?? true,
      verifiedAt: new Date(),
    },
  });
}

export async function createBillingSubscription(params: {
  businessId: string;
  productType?: BillingProductType;
  referenceId?: string;
  paymentMethodId?: string;
  status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  autoRenew?: boolean;
}) {
  return prisma.billingSubscription.create({
    data: {
      businessId: params.businessId,
      productType: params.productType ?? BillingProductType.AI_AGENT_SUITE,
      referenceId: params.referenceId ?? randomUUID(),
      status: params.status ?? 'TRIALING',
      baseFeeTetri: 9900,
      trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      autoRenew: params.autoRenew ?? true,
      paymentMethodId: params.paymentMethodId,
    },
  });
}

export async function createPayoutRequest(params: {
  userId: string;
  amount?: number;
  iban?: string;
  status?: PayoutRequestStatus;
  riskTier?: PayoutRiskTier;
  autoApproved?: boolean;
  processingStartedAt?: Date;
}) {
  const id = randomUUID();
  return prisma.payoutRequest.create({
    data: {
      id,
      userId: params.userId,
      amount: params.amount ?? 10000,
      iban: params.iban ?? 'GE29NB0000000101904917',
      status: params.status ?? PayoutRequestStatus.PENDING,
      riskTier: params.riskTier ?? PayoutRiskTier.MANUAL_REVIEW,
      autoApproved: params.autoApproved ?? false,
      idempotencyKey: generateIdempotencyKey(id),
      processingStartedAt: params.processingStartedAt,
    },
  });
}
