import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import type { Permission, UserRole } from '../../services/types';
import { Activity } from 'lucide-react';

interface ProtectedRouteProps {
  requiredPermission?: Permission;
  requiredRole?: UserRole | UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  requiredRole,
  children,
}) => {
  const { status, user } = useAuth();
  const { can, hasRole } = usePermission();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--surface-2)] text-[var(--ink)] gap-4 p-6 select-none">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center text-white shadow-lg animate-pulse">
          <Activity className="w-6 h-6 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold text-[var(--ink)] tracking-tight m-0">
            GMAO Gases Medicinales
          </p>
          <p className="text-xs text-[var(--ink-soft)] font-medium m-0">
            Verificando credenciales clínicas y permisos...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'anonymous' || !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Obligatoriedad de cambio de contraseña en primer login o reset
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Validación de permisos
  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
  }

  // Validación de roles
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
