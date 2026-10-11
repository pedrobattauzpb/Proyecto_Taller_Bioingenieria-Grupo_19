import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAlerts } from '../../context/AlertsContext';
import { AlertDropdown } from './AlertDropdown';
import type { Alert } from '../../services/types';

export const AlertBell: React.FC = () => {
  const navigate = useNavigate();
  const { summary, unreadCount } = useAlerts();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasCritical = (summary?.unacknowledged_critical ?? 0) > 0;
  const count = unreadCount > 0 ? unreadCount : summary?.open_total ?? 0;

  const handleSelectAlert = (alert: Alert) => {
    navigate(`/alerts?id=${alert.id}`);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
        aria-label={`Alertas (${count} pendientes)`}
        aria-expanded={dropdownOpen}
      >
        <Bell className="w-5 h-5" />

        {count > 0 && (
          <span
            aria-live="polite"
            className={`absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10.5px] font-extrabold rounded-full flex items-center justify-center text-white shadow-xs ${
              hasCritical
                ? 'bg-[var(--danger)] animate-pulse'
                : 'bg-[var(--warn)]'
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <AlertDropdown
        open={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        onSelectAlert={handleSelectAlert}
      />
    </div>
  );
};
