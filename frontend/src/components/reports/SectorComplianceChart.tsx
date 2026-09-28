import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SectorStat } from '../../services/types';

interface SectorComplianceChartProps {
  data: SectorStat[];
}

export const SectorComplianceChart: React.FC<SectorComplianceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[var(--ink-soft)]">
        Sin datos de sectores disponibles.
      </div>
    );
  }

  const chartData = data.map((s) => ({
    name: s.sector_name,
    compliance: Math.round(s.compliance_percentage * 10) / 10,
    assets: s.total_assets,
    inspections: s.total_inspections,
  }));

  const getColor = (val: number) => {
    if (val >= 100) return 'var(--ok)';
    if (val >= 80) return 'var(--accent)';
    return 'var(--warn)';
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
            stroke="var(--ink-faint)"
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--ink)"
            fontSize={11}
            width={120}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: any) => [`${value}%`, 'Cumplimiento']}
            labelFormatter={(label) => `Sector: ${label}`}
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--ink)',
              fontSize: '12px',
              boxShadow: 'var(--shadow)',
            }}
          />
          <Bar dataKey="compliance" radius={[0, 4, 4, 0]} barSize={18}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.compliance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
