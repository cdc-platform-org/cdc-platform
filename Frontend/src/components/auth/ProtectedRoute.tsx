import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user?.status === 'PENDING_APPROVAL') {
      router.replace('/auth/pending-approval');
      return;
    }

    if (user?.status === 'REJECTED') {
      router.replace('/auth/login?rejected=true');
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
    }
  }, [loading, isAuthenticated, user?.status, router]);

  if (loading || user?.status === 'PENDING_APPROVAL' || user?.status === 'REJECTED') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
