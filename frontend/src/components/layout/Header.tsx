import React from 'react';
import { Activity, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  hospitalName?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hospitalName = 'Hosp. Dr. Arturo Oñativia',
  onToggleSidebar,
}) => {
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

      {/* Badges de Normativas y Estado Clínico */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            Res. MSAL 1130/2000
          </span>
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            ISO 7396-1:2016
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 bg-[var(--ok-soft)] text-[var(--ok)] py-1 px-2.5 rounded-full text-xs font-bold select-none">
          <span className="w-2 h-2 rounded-full bg-[var(--ok)] animate-pulse" />
          <span>Red Operativa</span>
        </div>
      </div>
    </header>
  );
};
