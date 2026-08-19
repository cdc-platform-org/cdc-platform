export type GrantEligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_REVIEW';

export interface GrantSource {
  id: string;
  name: string;
  baseUrl: string;
  listingUrls: string[];
  isActive: boolean;
  lastScanAt: string | null;
  lastScanStatus: string | null;
  lastScanError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantOpportunity {
  id: string;
  source: { id: string; name: string; baseUrl?: string };
  sourceUrl: string;
  title: string;
  titleEn: string | null;
  summary: string;
  organization: string | null;
  deadline: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  georgiaEligible: boolean | null;
  georgiaEligibleReason: string;
  scopeMatch: boolean | null;
  scopeMatchReason: string;
  eligibilityStatus: GrantEligibilityStatus;
  isArchived: boolean;
  archivedReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScanSummary {
  sourcesScanned: number;
  sourcesFailed: number;
  linksChecked: number;
  newOpportunities: number;
  newlyEligible: number;
}
