import React from 'react';
import { usePermission } from '../../hooks/usePermission';
import type { Permission, UserRole } from '../../services/types';

interface CanProps {
  perm?: Permission | Permission[];
  role?: UserRole | UserRole[];
  match?: 'any' | 'all';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  perm,
  role,
  match = 'any',
  fallback = null,
  children,
}) => {
  const { can, canAny, canAll, hasRole } = usePermission();

  let hasPermission = true;
  if (perm) {
    if (Array.isArray(perm)) {
      hasPermission = match === 'all' ? canAll(...perm) : canAny(...perm);
    } else {
      hasPermission = can(perm);
    }
  }

  let hasRoleMatch = true;
  if (role) {
    hasRoleMatch = hasRole(role);
  }

  if (hasPermission && hasRoleMatch) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
