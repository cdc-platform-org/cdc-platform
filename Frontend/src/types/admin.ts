import { AdminRole } from './auth';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  isVerifiedGraduate: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  adminRole: AdminRole | null;
  earningsBalance: number;
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
}
