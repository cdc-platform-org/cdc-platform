import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';

export default function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    // AUDIT NOTE (fixed): this used to hardcode '/courses' unconditionally,
    // racing register.tsx's own router.push(postSignupRedirect(...)) the
    // instant registration flips `isAuthenticated` true — both fire around
    // the same tick, and this effect's router.replace() was winning,
    // silently stomping any explicit ?redirect= target (e.g. a guest sent
    // here from /career-test via AuthModal.tsx's goToRegister). Respecting
    // the same query param login/ProtectedRoute already use fixes that,
    // and is a no-op for every existing caller that never set it.
    const explicitRedirect = typeof router.query.redirect === 'string' ? router.query.redirect : undefined;
    router.replace(explicitRedirect || '/courses');
  }, [loading, isAuthenticated, router]);

  if (loading || isAuthenticated) return null;

  return <>{children}</>;
}
