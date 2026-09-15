import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, History, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onItemClick }) => {
  const navItems = [
    {
      label: 'Panel Principal',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Inspecciones',
      path: '/inspections',
      icon: ClipboardList,
    },
    {
      label: 'Historial de Auditoría',
      path: '/history',
      icon: History,
    },
  ];

  return (
    <aside className={cn('w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between gap-6 h-full select-none', className)}>
      {/* Navegación Principal */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
          NAVEGACIÓN
        </span>
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer no-underline',
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-600' : 'text-slate-500')} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Tarjeta de Trazabilidad y Normativas Clínicas */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Marco Normativo</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Auditoría de gases según Resolución MSAL 1130/2000 (control de envases) y norma ISO 7396-1 (redes fijas).
        </p>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
            O2 · 4-5 bar
          </span>
          <span className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
            Vacío · -0.7 bar
          </span>
        </div>
      </div>
    </aside>
  );
};
