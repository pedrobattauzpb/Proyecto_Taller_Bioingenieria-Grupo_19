import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from '../components/auth/RoleBadge';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] m-0">
        Acceso Restringido (403)
      </h1>

      <p className="text-sm text-[var(--ink-soft)] max-w-md mt-2 mb-4 leading-relaxed">
        Su rol y credenciales actuales no disponen de los permisos requeridos para acceder o ejecutar
        acciones en este módulo del sistema.
      </p>

      {user && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] mb-6 text-xs text-[var(--ink-soft)]">
          <span>Identificado como:</span>
          <strong className="text-[var(--ink)]">{user.full_name}</strong>
          <RoleBadge role={user.role} size="xs" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          title="Volver Atrás"
          variant="secondary"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="w-4 h-4" />}
        />
        <Button
          title="Ir al Panel Principal"
          variant="primary"
          onClick={() => navigate('/dashboard')}
          icon={<Home className="w-4 h-4" />}
        />
      </div>
    </div>
  );
};
