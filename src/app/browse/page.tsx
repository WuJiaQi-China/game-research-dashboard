'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecords } from '@/lib/hooks/useRecords';
import { deleteRecords } from '@/lib/firebase/firestore';
import { useT } from '@/lib/i18n/context';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCards } from '@/components/browse/KpiCards';
import { SourcePieChart } from '@/components/browse/SourcePieChart';
import { TagBarChart } from '@/components/browse/TagBarChart';
import { ResourceTable } from '@/components/browse/ResourceTable';
import { CsvExportButton } from '@/components/browse/CsvExportButton';
import { Inbox, X } from 'lucide-react';

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

  if (!records?.length && isLoading) {
    return <LoadingSpinner />;
  }

  if (!records || records.length === 0) {
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

      {/* Charts -- collapsible */}
      <details className="group" open>
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700 flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">&#9654;</span>
          {t('source_dist')}
        </summary>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SourcePieChart records={filtered} />
          <TagBarChart records={filtered} />
        </div>
      </details>

      {/* Resource Table -- collapsible */}
      <details className="group" open>
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700 flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">&#9654;</span>
          {t('resource_table')}
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t('n_records').replace('{}', String(filtered.length))}
            </span>
            <CsvExportButton records={filtered} filename="resources.csv" />
          </div>
          <ResourceTable records={filtered} onDelete={handleDelete} />
        </div>
      </details>
    </div>
  );
}
