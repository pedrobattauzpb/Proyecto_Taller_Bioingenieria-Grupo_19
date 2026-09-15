import React from 'react';
import { Activity, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  hospitalName?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hospitalName = 'Hosp. Dr. Arturo Oñativia',
  onToggleSidebar,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shadow-xs sticky top-0 z-30">
      {/* Brand e Identidad Clínica */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link to="/dashboard" className="flex items-center gap-3 text-inherit no-underline">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight m-0">
              Gases Medicinales
            </h1>
            <p className="text-[11px] text-slate-500 font-medium m-0">{hospitalName}</p>
          </div>
        </Link>
      </div>

      {/* Badges de Normativas y Estado Clínico */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2">
          <Badge label="Res. MSAL 1130/2000" variant="indigo" size="sm" />
          <Badge label="ISO 7396-1:2016" variant="emerald" size="sm" />
        </div>

        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 py-1 px-2.5 rounded-full text-xs font-bold select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Red Operativa</span>
        </div>
      </div>
    </header>
  );
};
