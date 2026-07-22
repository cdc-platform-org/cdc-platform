import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { AdminRole } from '../../types/auth';

interface AdminGuardProps {
  children: ReactNode;
  // Narrows access to specific tiers for a single section (e.g. Financials,
  // Team). Omit to just require "any admin-team member."
  requiredTiers?: AdminRole[];
}

export default function AdminGuard({ children, requiredTiers }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isOnTeam = !!user?.adminRole;
  const hasRequiredTier = !requiredTiers || (user?.adminRole && requiredTiers.includes(user.adminRole));

  useEffect(() => {
    if (loading) return;
    if (!isOnTeam) {
      router.replace('/');
    } else if (!hasRequiredTier) {
      router.replace('/admin');
    }
  }, [loading, isOnTeam, hasRequiredTier, router]);

  if (loading || !isOnTeam || !hasRequiredTier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
