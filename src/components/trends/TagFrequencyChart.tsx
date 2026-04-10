'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useT } from '@/lib/i18n/context';
import { SOURCE_LABELS, ALL_SOURCES } from '@/lib/constants';
import type { ContentRecord } from '@/lib/types';

interface TagFrequencyChartProps {
  records: ContentRecord[];
}

export function TagFrequencyChart({ records }: TagFrequencyChartProps) {
  const t = useT();
  const [selectedSource, setSelectedSource] = useState<string>('all');

  // Determine which sources actually have records
  const availableSources = useMemo(() => {
    const srcSet = new Set<string>();
    for (const r of records) {
      if (r.source) srcSet.add(r.source);
    }
    return ALL_SOURCES.filter((s) => srcSet.has(s));
  }, [records]);

  const data = useMemo(() => {
    const filtered =
      selectedSource === 'all'
        ? records
        : records.filter((r) => r.source === selectedSource);

    const counts = new Map<string, number>();
    for (const r of filtered) {
      for (const tag of r.tags ?? []) {
        const normalized = tag.trim().toLowerCase();
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
  }, [records, selectedSource]);

  const COLORS = [
    '#0096FA', '#FF6740', '#2ECC71', '#F5A623', '#9B59B6',
    '#E91E63', '#1B2838', '#7B68EE', '#FF6122', '#00D564',
    '#FA5C5C', '#4A90D9', '#CCFF00', '#FF6B9D', '#8B5CF6',
    '#13AFF0', '#FFB6C1', '#990000', '#FF6740', '#0096FA',
  ];

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4">{t('no_data')}</p>
    );
  }

  return (
    <div>
      {/* Source selector */}
      <div className="mb-4">
        <label className="text-sm text-gray-500 mr-2">{t('select_source')}</label>
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t('all_sources')}</option>
          {availableSources.map((src) => (
            <option key={src} value={src}>
              {SOURCE_LABELS[src] ?? src}
            </option>
          ))}
        </select>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={Math.max(400, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            dataKey="tag"
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
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
