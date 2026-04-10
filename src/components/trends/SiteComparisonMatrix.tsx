'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n/context';
import { SOURCE_LABELS } from '@/lib/constants';
import type { ContentRecord } from '@/lib/types';

interface SiteComparisonMatrixProps {
  records: ContentRecord[];
}

export function SiteComparisonMatrix({ records }: SiteComparisonMatrixProps) {
  const t = useT();

  const { sources, topTags, matrix, maxCount } = useMemo(() => {
    // Count global tag frequency to pick top 10
    const globalTagCounts = new Map<string, number>();
    const sourcesSet = new Set<string>();

    for (const r of records) {
      if (r.source) sourcesSet.add(r.source);
      for (const tag of r.tags ?? []) {
        const normalized = tag.trim().toLowerCase();
        if (normalized) {
          globalTagCounts.set(normalized, (globalTagCounts.get(normalized) ?? 0) + 1);
        }
      }
    }

    const topTags = [...globalTagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const sources = [...sourcesSet].sort();

    // Build source x tag matrix
    const matrix = new Map<string, Map<string, number>>();
    let maxCount = 0;

    for (const src of sources) {
      const tagMap = new Map<string, number>();
      matrix.set(src, tagMap);
    }

    for (const r of records) {
      if (!r.source) continue;
      const tagMap = matrix.get(r.source);
      if (!tagMap) continue;
      for (const tag of r.tags ?? []) {
        const normalized = tag.trim().toLowerCase();
        if (topTags.includes(normalized)) {
          const count = (tagMap.get(normalized) ?? 0) + 1;
          tagMap.set(normalized, count);
          if (count > maxCount) maxCount = count;
        }
      }
    }

    return { sources, topTags, matrix, maxCount };
  }, [records]);

  if (sources.length === 0 || topTags.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4">{t('no_data')}</p>
    );
  }

  const getOpacity = (count: number): number => {
    if (maxCount === 0 || count === 0) return 0;
    return 0.15 + (count / maxCount) * 0.85;
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">{t('site_tag_matrix')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-gray-600 font-medium border-b border-gray-200 bg-gray-50 sticky left-0 z-10">
                Source
              </th>
              {topTags.map((tag) => (
                <th
                  key={tag}
                  className="px-3 py-2 text-gray-600 font-medium border-b border-gray-200 bg-gray-50 text-center whitespace-nowrap"
                >
                  {tag}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((src) => {
              const tagMap = matrix.get(src)!;
              return (
                <tr key={src} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-700 border-b border-gray-100 whitespace-nowrap bg-white sticky left-0 z-10">
                    {SOURCE_LABELS[src] ?? src}
                  </td>
                  {topTags.map((tag) => {
                    const count = tagMap.get(tag) ?? 0;
                    return (
                      <td
                        key={tag}
                        className="px-3 py-2 text-center border-b border-gray-100 relative"
                      >
                        <div
                          className="absolute inset-0 rounded-sm"
                          style={{
                            backgroundColor: '#0096FA',
                            opacity: getOpacity(count),
                          }}
                        />
                        <span className="relative z-10 text-xs font-medium text-gray-800">
                          {count > 0 ? count : ''}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
