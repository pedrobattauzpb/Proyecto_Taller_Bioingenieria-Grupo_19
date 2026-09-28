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
import type { AssetTypeStat } from '../../services/types';

interface AssetTypeComplianceChartProps {
  data: AssetTypeStat[];
}

export const AssetTypeComplianceChart: React.FC<AssetTypeComplianceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[var(--ink-soft)]">
        Sin datos de familias de componentes.
      </div>
    );
  }

  const chartData = data.map((t) => ({
    name: t.asset_type.length > 22 ? `${t.asset_type.substring(0, 20)}...` : t.asset_type,
    fullName: t.asset_type,
    compliance: Math.round(t.compliance_percentage * 10) / 10,
    assets: t.total_assets,
    inspections: t.total_inspections,
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
          margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
        >
          <XAxis
            dataKey="name"
            stroke="var(--ink-soft)"
            fontSize={10.5}
            interval={0}
            angle={-15}
            textAnchor="end"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
            stroke="var(--ink-faint)"
            fontSize={11}
          />
          <Tooltip
            formatter={(value: any) => [`${value}%`, 'Cumplimiento']}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload;
              return item ? item.fullName : '';
            }}
            contentStyle={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--ink)',
              fontSize: '12px',
              boxShadow: 'var(--shadow)',
            }}
          />
          <Bar dataKey="compliance" radius={[4, 4, 0, 0]} barSize={26}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.compliance)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
