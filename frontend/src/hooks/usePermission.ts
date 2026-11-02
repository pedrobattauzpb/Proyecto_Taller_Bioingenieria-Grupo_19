import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Permission, UserRole } from '../services/types';

export function usePermission() {
  const { user, permissions } = useAuth();

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return permissions.includes(permission);
    },
    [user, permissions]
  );

  const canAny = useCallback(
    (...perms: Permission[]): boolean => {
      if (!user) return false;
      return perms.some((p) => permissions.includes(p));
    },
    [user, permissions]
  );

  const canAll = useCallback(
    (...perms: Permission[]): boolean => {
      if (!user) return false;
      return perms.every((p) => permissions.includes(p));
    },
    [user, permissions]
  );

  const hasRole = useCallback(
    (roleOrRoles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      if (Array.isArray(roleOrRoles)) {
        return roleOrRoles.includes(user.role);
      }
      return user.role === roleOrRoles;
    },
    [user]
  );

  const hasHospitalScope = useCallback(
    (hospitalId: number): boolean => {
      if (!user) return false;
      if (user.has_global_scope) return true;
      return user.hospital_ids.includes(hospitalId);
    },
    [user]
  );

  return {
    user,
    permissions,
    role: user?.role,
    isScopeGlobal: Boolean(user?.has_global_scope),
    can,
    canAny,
    canAll,
    hasRole,
    hasHospitalScope,
  };
}
