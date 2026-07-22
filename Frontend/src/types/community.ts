interface Poster {
  id: string;
  name: string;
  role: 'Client' | 'SuperAdmin';
}

interface AssignedFreelancer {
  id: string;
  name: string;
  role: 'Student';
  isVerifiedGraduate: boolean;
}

// ============================================================
// VACANCIES — unchanged from before
// ============================================================

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type VacancyStatus = 'open' | 'closed' | 'filled';

export interface Vacancy {
  id: string;
  title: string;
  description: string;
  postedBy: Poster;
  employmentType: EmploymentType;
  location: string;
  skillsRequired: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  applicationDeadline: string | null;
  status: VacancyStatus;
  postedAt: string;
}

export type ApplicationStatus = 'submitted' | 'reviewed' | 'accepted' | 'rejected';

export interface VacancyApplication {
  id: string;
  vacancyId: string;
  applicantId: string;
  applicantName: string; // needed for the poster's review list — display only
  coverNote: string;
  status: ApplicationStatus;
  submittedAt: string;
}

// ============================================================
// GIGS — now approval-based, mirrors the vacancy application flow
// ============================================================

export type GigBudgetType = 'fixed' | 'hourly';
export type GigStatus =
  | 'open'          // accepting applications
  | 'assigned'      // poster approved a freelancer; work not yet delivered
  | 'submitted'     // freelancer submitted work, awaiting poster review
  | 'completed'
  | 'cancelled';

export interface Gig {
  id: string;
  title: string;
  description: string;
  postedBy: Poster;
  budgetType: GigBudgetType;
  budgetAmount: number;   // the poster's stated budget, minor units
  currency: string;
  skillsRequired: string[];
  deadline: string | null;
  status: GigStatus;
  assignedFreelancerId: string | null; // set only once an application is approved
  assignedFreelancer: AssignedFreelancer | null;
  applicationsCount: number;
  // Set once the freelancer submits delivered work (status -> 'submitted').
  submittedAt: string | null;
  deliveryComment: string | null;
  deliveryFiles: string[];
  deliveryLinks: string[];
  postedAt: string;
}

// --- Client Portal: gigs the caller posted (GET /gigs/mine) ---

export interface MyGigTransaction {
  id: string;
  status: 'HELD_IN_ESCROW' | 'RELEASED';
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  capturedAt: string;
  releasedAt: string | null;
}

export interface MyGig {
  id: string;
  title: string;
  description: string;
  budgetType: GigBudgetType;
  budgetAmount: number;
  currency: string;
  skillsRequired: string[];
  deadline: string | null;
  status: GigStatus;
  assignedFreelancerId: string | null;
  assignedFreelancer: AssignedFreelancer | null;
  applicationsCount: number;
  submittedAt: string | null;
  createdAt: string;
  transaction: MyGigTransaction | null;
}

export interface GigApplication {
  id: string;
  gigId: string;
  applicantId: string;
  applicant: { id: string; name: string; isVerifiedGraduate: boolean };
  proposalNote: string;
  bidAmount: number;      // the freelancer's proposed price, minor units — may differ from budgetAmount
  deliveryDays: number;
  status: ApplicationStatus;
  createdAt: string;
}