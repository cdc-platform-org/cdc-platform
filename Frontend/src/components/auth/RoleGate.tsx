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

  if (!user || (!allowedRoles.includes(user.role) && user.role !== 'SuperAdmin' && user.role !== 'Admin')) {
    // Allow SuperAdmin and Admin to bypass all role restrictions
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
