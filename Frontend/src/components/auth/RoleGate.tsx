import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/auth';

interface RoleGateProps {
  allowedRoles: User['role'][];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
