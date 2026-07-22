import { AdminRole } from './auth';

export interface DashboardStats {
  users: {
    total: number;
    pendingApproval: number;
    banned: number;
    students: number;
    clients: number;
  };
  gigs: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  vacancies: {
    total: number;
    byStatus: Record<string, number>;
  };
  volume: {
    totalGrossAmount: number;
    totalCommissionAmount: number;
    totalNetAmount: number;
    transactionCount: number;
  };
}

interface ListingParticipant {
  id: string;
  name: string;
  email: string;
  role: string;
  adminRole: AdminRole | null;
}

export interface ModeratedListing {
  id: string;
  title: string;
  description: string;
  status: string;
  moderationStatus: 'approved' | 'removed';
  moderatedAt: string | null;
  moderationReason: string | null;
  postedBy: ListingParticipant;
  createdAt: string;
  listingType: 'gig' | 'vacancy';
}

export interface AdminTransaction {
  id: string;
  gig: { id: string; title: string };
  client: ListingParticipant;
  freelancer: ListingParticipant;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  capturedAt: string;
  releasedAt: string | null;
  createdAt: string;
}

export interface BogSettings {
  clientId: string | null;
  secretKey: string | null; // masked once set — e.g. "••••1234"
  isLiveMode: boolean;
  updatedByEmail: string | null;
  updatedAt: string;
}

export interface UpdateBogSettingsPayload {
  clientId?: string;
  secretKey?: string;
  isLiveMode?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  adminRole: AdminRole;
  isBanned: boolean;
  createdAt: string;
}
