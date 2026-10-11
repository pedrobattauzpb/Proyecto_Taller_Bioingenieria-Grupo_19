import React from 'react';
import { useAlerts } from '../../context/AlertsContext';
import { Link } from 'react-router-dom';

export const NetworkHealthIndicator: React.FC = () => {
  const { summary, connection } = useAlerts();

  if (connection === 'offline') {
    return (
      <div
        className="inline-flex items-center gap-1.5 bg-[var(--surface-2)] text-[var(--ink-faint)] border border-[var(--border)] py-1 px-2.5 rounded-full text-xs font-semibold select-none cursor-default"
        title="Sin conexión en vivo con el servidor central de alertas"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--ink-faint)]" />
        <span>Sin Conexión</span>
      </div>
    );
  }

  const health = summary?.health ?? 'OK';
  const openTotal = summary?.open_total ?? 0;
  const criticalCount = summary?.unacknowledged_critical ?? 0;

  let config = {
    label: 'Red Operativa',
    bg: 'bg-[var(--ok-soft)]',
    text: 'text-[var(--ok)]',
    dot: 'bg-[var(--ok)]',
    pulse: true,
  };

  if (health === 'CRITICAL' || criticalCount > 0) {
    config = {
      label: `Falla Crítica (${criticalCount > 0 ? criticalCount : openTotal})`,
      bg: 'bg-[var(--danger-soft)]',
      text: 'text-[var(--danger)]',
      dot: 'bg-[var(--danger)]',
      pulse: true,
    };
  } else if (health === 'DEGRADED' || openTotal > 0) {
    config = {
      label: `Desvíos Activos (${openTotal})`,
      bg: 'bg-[var(--warn-soft)]',
      text: 'text-[var(--warn)]',
      dot: 'bg-[var(--warn)]',
      pulse: false,
    };
  }

  return (
    <Link
      to="/alerts"
      className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} py-1 px-2.5 rounded-full text-xs font-bold select-none cursor-pointer hover:opacity-90 transition-opacity no-underline`}
      title={`Estado de la red clínica: ${config.label}. Haga clic para ver detalles.`}
    >
      <span
        className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      <span>{config.label}</span>
    </Link>
  );
};
