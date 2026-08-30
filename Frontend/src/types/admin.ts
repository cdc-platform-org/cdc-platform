import { AdminRole } from './auth';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  isVerifiedGraduate: boolean;
  // Grants access to /admin/hr-requests's specialist-facing screens.
  isHrSpecialist: boolean;
  // AI Educator VIP Hub — post-trial admin grant (see Backend's
  // User.educatorVipActive schema comment). Independent of the cardless
  // 5-day trial, which any account can self-start regardless of this flag.
  educatorVipActive: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  adminRole: AdminRole | null;
  earningsBalance: number;
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
}
