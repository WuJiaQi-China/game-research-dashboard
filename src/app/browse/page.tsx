'use client';

import { useRecords } from '@/lib/hooks/useRecords';
import { useT } from '@/lib/i18n/context';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCards } from '@/components/browse/KpiCards';
import { SourcePieChart } from '@/components/browse/SourcePieChart';
import { TagBarChart } from '@/components/browse/TagBarChart';
import { ResourceTable } from '@/components/browse/ResourceTable';
import { CsvExportButton } from '@/components/browse/CsvExportButton';
import { Inbox } from 'lucide-react';

export default function BrowsePage() {
  const t = useT();
  const { data: records, isLoading } = useRecords();

  if (isLoading) {
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

      {/* KPI Cards */}
      <KpiCards records={records} />

      {/* Charts -- collapsible */}
      <details className="group" open>
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700 flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">&#9654;</span>
          {t('source_dist')}
        </summary>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SourcePieChart records={records} />
          <TagBarChart records={records} />
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
              {t('n_records').replace('{}', String(records.length))}
            </span>
            <CsvExportButton records={records} filename="resources.csv" />
          </div>
          <ResourceTable records={records} />
        </div>
      </details>
    </div>
  );
}
