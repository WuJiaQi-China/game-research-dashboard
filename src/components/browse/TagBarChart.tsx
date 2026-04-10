'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useT } from '@/lib/i18n/context';
import type { ContentRecord } from '@/lib/types';

interface TagBarChartProps {
  records: ContentRecord[];
}

export function TagBarChart({ records }: TagBarChartProps) {
  const t = useT();

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      if (!r.tags) continue;
      for (const tag of r.tags) {
        const normalized = tag.trim().toLowerCase();
        if (normalized) {
          counts[normalized] = (counts[normalized] || 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }, [records]);

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[320px]">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        {t('tag_dist')}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 100 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="tag"
            width={90}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [String(value), t('total_records')]}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
