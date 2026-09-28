import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface SeverityPieChartProps {
  distribution: Record<string, number>;
}

export const SeverityPieChart: React.FC<SeverityPieChartProps> = ({ distribution }) => {
  const data = [
    { name: 'Críticos (Nivel 1)', key: 'CRITICAL', value: distribution.CRITICAL || 0, color: 'var(--critical, #b91c1c)' },
    { name: 'Mayores (Nivel 2)', key: 'MAJOR', value: distribution.MAJOR || 0, color: 'var(--warn, #b8770a)' },
    { name: 'Menores (Nivel 3)', key: 'MINOR', value: distribution.MINOR || 0, color: '#eab308' },
    { name: 'Observaciones', key: 'OBSERVATION', value: distribution.OBSERVATION || 0, color: 'var(--ok, #1f8a5a)' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[var(--ink-soft)]">
        No se registran desvíos normativos en el establecimiento.
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any) => [`${value} desvíos`, name]}
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--ink)',
              fontSize: '12px',
              boxShadow: 'var(--shadow)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-[var(--ink)] font-medium">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
