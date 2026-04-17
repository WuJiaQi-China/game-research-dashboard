'use client';

import { Database, BookOpen, Globe } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { useT } from '@/lib/i18n/context';
import { getBrowseKpis } from '@/lib/kpiCache';
import type { ContentRecord } from '@/lib/types';

interface KpiCardsProps {
  records: ContentRecord[];
}

export function KpiCards({ records }: KpiCardsProps) {
  const t = useT();

  // Module-level WeakMap cache — first compute is 200-500ms, every subsequent
  // render for the same `records` reference is O(1). Survives component
  // unmount/remount, unlike useMemo.
  const stats = getBrowseKpis(records);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <MetricCard
        label={t('total_records')}
        value={stats.total}
        icon={<Database size={20} />}
      />
      <MetricCard
        label={t('unique_titles')}
        value={stats.uniqueTitles}
        icon={<BookOpen size={20} />}
      />
      <MetricCard
        label={t('sites_covered')}
        value={stats.sitesCovered}
        icon={<Globe size={20} />}
      />
    </div>
  );
}
