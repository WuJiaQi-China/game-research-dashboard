'use client';

import Link from 'next/link';
import { TrendingUp, Bot, Settings } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useRecords } from '@/lib/hooks/useRecords';
import { MetricCard } from '@/components/ui/MetricCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TagFrequencyChart } from '@/components/trends/TagFrequencyChart';
import { SiteComparisonMatrix } from '@/components/trends/SiteComparisonMatrix';

export default function TrendsPage() {
  const t = useT();
  const { data: records, isLoading } = useRecords();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!records || records.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('trend_header')}</h1>
        <EmptyState message={t('no_data_hint')} icon={<TrendingUp size={32} />} />
      </div>
    );
  }

  // KPI computations
  const uniqueTags = new Set<string>();
  const uniqueSources = new Set<string>();
  for (const r of records) {
    if (r.source) uniqueSources.add(r.source);
    for (const tag of r.tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) uniqueTags.add(normalized);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('trend_header')}</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label={t('total_records')}
          value={records.length}
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          label={t('col_tags')}
          value={uniqueTags.size}
        />
        <MetricCard
          label={t('sites_covered')}
          value={uniqueSources.size}
        />
      </div>

      {/* Tag Frequency */}
      <CollapsibleSection title={t('tag_freq')} defaultOpen={true}>
        <TagFrequencyChart records={records} />
      </CollapsibleSection>

      {/* Site Comparison */}
      <CollapsibleSection title={t('site_compare')} defaultOpen={false}>
        <SiteComparisonMatrix records={records} />
      </CollapsibleSection>

      {/* LLM Trend Analysis placeholder */}
      <CollapsibleSection title={t('llm_section')} defaultOpen={false}>
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Bot size={36} className="mb-3 text-gray-300" />
          <p className="text-sm mb-3">{t('llm_not_configured')}</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Settings size={14} />
            {t('settings_btn')}
          </Link>
        </div>
      </CollapsibleSection>
    </div>
  );
}
