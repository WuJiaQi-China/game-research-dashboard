'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Users, Eye, Globe } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n/context';
import { useArtists, useTopArtists } from '@/lib/hooks/useArtists';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

// Code-split heavy components — all are inside CollapsibleSection blocks and
// only ArtistGallery renders immediately (its section defaults to collapsed now
// too, so it's just as deferred as the others).
const ArtistGallery = dynamic(
  () => import('@/components/art/ArtistGallery').then(m => ({ default: m.ArtistGallery })),
  { ssr: false },
);
const StyleTagChart = dynamic(
  () => import('@/components/art/StyleTagChart').then(m => ({ default: m.StyleTagChart })),
  { ssr: false },
);
const ToolsDistChart = dynamic(
  () => import('@/components/art/ToolsDistChart').then(m => ({ default: m.ToolsDistChart })),
  { ssr: false },
);
const ArtistRankingTable = dynamic(
  () => import('@/components/art/ArtistRankingTable').then(m => ({ default: m.ArtistRankingTable })),
  { ssr: false },
);

export default function ArtPage() {
  const t = useT();
  const { lang } = useI18n();
  const { data: allArtists, isLoading } = useArtists();
  const { data: topArtists } = useTopArtists(20);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!allArtists.length)
      return { total: 0, avgViews: 0, topSource: '-' };

    const totalViews = allArtists.reduce((s, a) => s + (a.totalViews ?? 0), 0);
    const avgViews = Math.round(totalViews / allArtists.length);

    // Find most common source
    const srcCounts = new Map<string, number>();
    for (const a of allArtists) {
      srcCounts.set(a.source, (srcCounts.get(a.source) ?? 0) + 1);
    }
    let topSource = '-';
    let maxCount = 0;
    for (const [src, cnt] of srcCounts) {
      if (cnt > maxCount) {
        topSource = src;
        maxCount = cnt;
      }
    }

    return { total: allArtists.length, avgViews, topSource };
  }, [allArtists]);

  const fmtNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('tab_art')}</h1>

      {/* KPI row — always render so the page shell appears instantly */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label={t('art_total_artists')}
          value={kpis.total}
          icon={<Users size={20} />}
        />
        <MetricCard
          label={t('art_avg_views')}
          value={fmtNum(kpis.avgViews)}
          icon={<Eye size={20} />}
        />
        <MetricCard
          label={t('art_top_source')}
          value={kpis.topSource}
          icon={<Globe size={20} />}
        />
      </div>

      {/* Artist Gallery */}
      <CollapsibleSection title={t('art_gallery')} defaultOpen={false}>
        <ArtistGallery artists={topArtists} />
      </CollapsibleSection>

      {/* Style Tag Analysis */}
      <CollapsibleSection title={t('art_style_trends')} defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">
              {lang === 'zh' ? '画风标签 Top 25' : 'Style Tags Top 25'}
            </h3>
            <StyleTagChart artists={allArtists} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">
              {t('art_tools')}
            </h3>
            <ToolsDistChart artists={allArtists} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Artist Ranking */}
      <CollapsibleSection title={t('art_ranking')} defaultOpen={false}>
        <ArtistRankingTable artists={allArtists} />
      </CollapsibleSection>

      {/* Empty hint — only after loading completes with zero results */}
      {!isLoading && allArtists.length === 0 && (
        <EmptyState message={t('art_no_data')} />
      )}
    </div>
  );
}
