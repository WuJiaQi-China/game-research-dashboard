'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ArtistRecord } from '@/lib/types';

interface ToolsDistChartProps {
  artists: ArtistRecord[];
}

export function ToolsDistChart({ artists }: ToolsDistChartProps) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of artists) {
      for (const tool of a.toolsMedium ?? []) {
        const t = tool.trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([tool, count]) => ({ tool, count }));
  }, [artists]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20 }}>
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis
          dataKey="tool"
          type="category"
          width={110}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value) => [String(value), 'Count']}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#7B68EE" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
