'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { useRecords } from '@/lib/hooks/useRecords';
import { deleteRecords } from '@/lib/firebase/firestore';
import { useT } from '@/lib/i18n/context';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { KpiCards } from '@/components/browse/KpiCards';
import { CsvExportButton } from '@/components/browse/CsvExportButton';
import { Inbox, X } from 'lucide-react';

// Code-split charts and the heavy resource table — keeps the browse shell chunk small.
const SourcePieChart = dynamic(
  () => import('@/components/browse/SourcePieChart').then(m => ({ default: m.SourcePieChart })),
  { ssr: false },
);
const TagBarChart = dynamic(
  () => import('@/components/browse/TagBarChart').then(m => ({ default: m.TagBarChart })),
  { ssr: false },
);
const ResourceTable = dynamic(
  () => import('@/components/browse/ResourceTable').then(m => ({ default: m.ResourceTable })),
  { ssr: false },
);

interface TrendFilter {
  tags: string[];
  name: string;
}

export default function BrowsePage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useRecords();
  const [trendFilter, setTrendFilter] = useState<TrendFilter | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Hydrate trend filter from localStorage (set by Trends page)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('trend_filter');
      if (raw) {
        const parsed: TrendFilter = JSON.parse(raw);
        if (parsed.tags?.length) {
          setTrendFilter(parsed);
        }
        // Clear after reading so it doesn't persist across manual navigations
        localStorage.removeItem('trend_filter');
      }
    } catch {}
  }, []);

  const handleClearFilter = () => {
    setTrendFilter(null);
  };

  const handleDelete = useCallback(async (ids: string[]) => {
    setDeleteError(null);
    try {
      await deleteRecords(ids);
      await queryClient.invalidateQueries({ queryKey: ['records'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDeleteError(msg);
      throw e;
    }
  }, [queryClient]);

  // Apply the trend-page cross-navigation tag filter, if any.
  // IMPORTANT: this hook must run on every render, BEFORE any conditional
  // early return (Rules of Hooks).
  const filtered = useMemo(() => {
    if (!records) return [];
    if (!trendFilter) return records;
    return records.filter(r => {
      const tagSet = new Set((r.tags ?? []).map(tag => tag.toLowerCase()));
      return trendFilter.tags.some(tag => tagSet.has(tag.toLowerCase()));
    });
  }, [records, trendFilter]);

  // Only short-circuit to empty-state once the query has resolved with zero rows.
  // While loading, render the full page shell so the tab click feels instant.
  if (!isLoading && (!records || records.length === 0)) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {t('tab_browse')}
        </h1>
        <EmptyState
          message={t('no_data_hint')}
          icon={<Inbox size={40} />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t('tab_browse')}
      </h1>

      {/* Trend filter banner */}
      {trendFilter && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm text-blue-800">
            {t('trend_filter_active').replace('{}', trendFilter.name)}
          </span>
          <button
            type="button"
            onClick={handleClearFilter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 transition-colors cursor-pointer"
          >
            <X size={12} />
            {t('clear_trend_filter')}
          </button>
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm text-red-800">
            {t('delete_failed')}: {deleteError}
          </span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-red-400 hover:text-red-600 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards records={filtered} />

      {/* Charts */}
      <CollapsibleSection title={t('source_dist')} defaultOpen={true}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SourcePieChart records={filtered} />
          <TagBarChart records={filtered} />
        </div>
      </CollapsibleSection>

      {/* Resource Table */}
      <CollapsibleSection title={t('resource_table')} defaultOpen={true}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t('n_records').replace('{}', String(filtered.length))}
            </span>
            <CsvExportButton records={filtered} filename="resources.csv" />
          </div>
          <ResourceTable records={filtered} onDelete={handleDelete} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
