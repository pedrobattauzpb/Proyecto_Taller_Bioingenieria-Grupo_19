import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Info, Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onItemClick }) => {
  const { theme, toggleTheme } = useTheme();

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
  ];

  return (
    <aside
      className={cn(
        'w-64 bg-[var(--surface)] border-r border-[var(--border)] p-4 flex flex-col justify-between gap-6 h-full select-none transition-colors',
        className
      )}
    >
      {/* Navegación Principal */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold text-[var(--ink-faint)] uppercase tracking-wider px-3 mb-2">
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
                  'flex items-center gap-2.5 py-2 px-3 rounded-lg text-sm transition-all cursor-pointer no-underline',
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--ink-faint)]')} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Sección Inferior: Botón de Tema y Nota Normativa */}
      <div className="flex flex-col gap-3">
        {/* Botón de Alternancia de Tema / Paleta */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-between w-full py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--accent)] text-xs font-semibold cursor-pointer transition-all"
          title={`Cambiar a ${theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}`}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--accent)]" />
            )}
            <span>{theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
          </div>
          <span className="text-[10px] font-bold text-[var(--ink-faint)] uppercase">
            {theme === 'dark' ? 'Oscuro' : 'Claro'}
          </span>
        </button>

        {/* Footer Normativo */}
        <div className="pt-3 border-t border-[var(--border)] flex items-start gap-2 text-[11.5px] text-[var(--ink-faint)] leading-relaxed">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--ink-faint)]" />
          <span>Res. MSAL 1130/2000 · ISO 7396-1. Ver detalle en "Marco normativo".</span>
        </div>
      </div>
    </aside>
  );
};
