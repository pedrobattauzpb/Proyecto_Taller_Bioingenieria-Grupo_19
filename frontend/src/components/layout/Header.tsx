import React, { useState, useRef, useEffect } from 'react';
import { Activity, Menu, User, LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertBell } from '../alerts/AlertBell';
import { NetworkHealthIndicator } from '../alerts/NetworkHealthIndicator';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../auth/RoleBadge';

interface HeaderProps {
  hospitalName?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hospitalName = 'Hosp. Dr. Arturo Oñativia',
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 transition-colors">
      {/* Brand e Identidad Clínica */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link to="/dashboard" className="flex items-center gap-3 text-inherit no-underline">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
            <Activity className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-[var(--ink)] tracking-tight leading-tight m-0">
              Gases Medicinales
            </h1>
            <p className="text-[11px] text-[var(--ink-faint)] font-medium m-0">{hospitalName}</p>
          </div>
        </Link>
      </div>

      {/* Badges de Normativas, Estado Clínico, Alertas y Menú de Usuario */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            Res. MSAL 1130/2000
          </span>
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            ISO 7396-1:2016
          </span>
        </div>

        <NetworkHealthIndicator />

        <div className="border-l border-[var(--border)] pl-1.5 ml-0.5">
          <AlertBell />
        </div>

        {/* Menú de Usuario Autenticado */}
        {user && (
          <div className="relative border-l border-[var(--border)] pl-2 ml-1" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-left cursor-pointer transition-colors"
              aria-label="Menú de perfil"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user.full_name.charAt(0).toUpperCase()}
              </div>

              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-[var(--ink)] line-clamp-1 leading-snug">
                  {user.full_name}
                </span>
                <span className="text-[10px] text-[var(--ink-faint)] font-medium leading-tight">
                  {user.professional_license ? `Mat. ${user.professional_license}` : user.email}
                </span>
              </div>

              <div className="hidden md:block">
                <RoleBadge role={user.role} size="xs" />
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-faint)]" />
            </button>

            {/* Dropdown del menú */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] rounded-2xl shadow-xl py-2 z-50 animate-in fade-in flex flex-col">
                <div className="px-3.5 py-2.5 border-b border-[var(--border)] flex flex-col gap-1">
                  <span className="font-bold text-xs text-[var(--ink)]">{user.full_name}</span>
                  <span className="text-[11px] text-[var(--ink-soft)] truncate">{user.email}</span>
                  <div className="pt-1">
                    <RoleBadge role={user.role} size="xs" />
                  </div>
                </div>

                <div className="py-1 flex flex-col">
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] no-underline transition-colors"
                  >
                    <User className="w-4 h-4 text-[var(--accent)]" />
                    <span>Mi Perfil</span>
                  </Link>

                  <Link
                    to="/change-password"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] no-underline transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-[var(--accent)]" />
                    <span>Cambiar Contraseña</span>
                  </Link>
                </div>

                <div className="pt-1 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
