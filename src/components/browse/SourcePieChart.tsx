'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SOURCE_COLORS } from '@/lib/constants';
import { useT } from '@/lib/i18n/context';
import type { ContentRecord } from '@/lib/types';

interface SourcePieChartProps {
  records: ContentRecord[];
}

const FALLBACK_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE',
  '#00C49F', '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57',
];

export function SourcePieChart({ records }: SourcePieChartProps) {
  const t = useT();

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const src = r.source || 'unknown';
      counts[src] = (counts[src] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[320px]">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        {t('source_dist')}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
            }
            labelLine={true}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={
                  SOURCE_COLORS[entry.name] ??
                  FALLBACK_COLORS[i % FALLBACK_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [String(value), t('total_records')]}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
