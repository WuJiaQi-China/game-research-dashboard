'use client';

import { useMemo } from 'react';
import { Database, BookOpen, Globe } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { useT } from '@/lib/i18n/context';
import type { ContentRecord } from '@/lib/types';

interface KpiCardsProps {
  records: ContentRecord[];
}

export function KpiCards({ records }: KpiCardsProps) {
  const t = useT();

  const stats = useMemo(() => {
    const uniqueTitles = new Set(records.map((r) => r.title || r.name)).size;
    const sitesCovered = new Set(records.map((r) => r.source)).size;
    return { total: records.length, uniqueTitles, sitesCovered };
  }, [records]);

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
