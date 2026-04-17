/**
 * Module-level KPI computation cache.
 *
 * React's `useMemo` only caches within a single component instance. When a
 * component unmounts (e.g., route change), its memoized value is discarded,
 * and on remount the computation runs again — even if the input data is
 * identical. For large arrays this is the main reason KPI cards take
 * 200-500ms to appear on every page switch.
 *
 * The WeakMap here keys results by the raw array reference returned from
 * React Query. As long as React Query returns the same reference (i.e., no
 * background refetch has produced a new array), the cache hits across all
 * mounts and renders, across all components.
 */

import type { ContentRecord, ArtistRecord } from './types';

// ---------------------------------------------------------------------------
// Browse page KPIs
// ---------------------------------------------------------------------------

export interface BrowseKpis {
  total: number;
  uniqueTitles: number;
  sitesCovered: number;
}

const EMPTY_BROWSE: BrowseKpis = { total: 0, uniqueTitles: 0, sitesCovered: 0 };
const browseCache = new WeakMap<ContentRecord[], BrowseKpis>();

export function getBrowseKpis(records: ContentRecord[] | undefined): BrowseKpis {
  if (!records || records.length === 0) return EMPTY_BROWSE;
  let kpis = browseCache.get(records);
  if (kpis) return kpis;
  const titles = new Set<string>();
  const sources = new Set<string>();
  for (const r of records) {
    titles.add(r.title || r.name);
    if (r.source) sources.add(r.source);
  }
  kpis = {
    total: records.length,
    uniqueTitles: titles.size,
    sitesCovered: sources.size,
  };
  browseCache.set(records, kpis);
  return kpis;
}

// ---------------------------------------------------------------------------
// Trends page KPIs (unique tags + unique sources)
// ---------------------------------------------------------------------------

export interface TrendsKpis {
  total: number;
  uniqueTagsSize: number;
  uniqueSourcesSize: number;
}

const EMPTY_TRENDS: TrendsKpis = { total: 0, uniqueTagsSize: 0, uniqueSourcesSize: 0 };
const trendsCache = new WeakMap<ContentRecord[], TrendsKpis>();

export function getTrendsKpis(records: ContentRecord[] | undefined): TrendsKpis {
  if (!records || records.length === 0) return EMPTY_TRENDS;
  let kpis = trendsCache.get(records);
  if (kpis) return kpis;
  const tags = new Set<string>();
  const sources = new Set<string>();
  for (const r of records) {
    if (r.source) sources.add(r.source);
    for (const t of r.tags ?? []) {
      const n = t.trim().toLowerCase();
      if (n) tags.add(n);
    }
  }
  kpis = {
    total: records.length,
    uniqueTagsSize: tags.size,
    uniqueSourcesSize: sources.size,
  };
  trendsCache.set(records, kpis);
  return kpis;
}

// ---------------------------------------------------------------------------
// Art page KPIs (total artists, avg views, top source)
// ---------------------------------------------------------------------------

export interface ArtKpis {
  total: number;
  avgViews: number;
  topSource: string;
}

const EMPTY_ART: ArtKpis = { total: 0, avgViews: 0, topSource: '-' };
const artCache = new WeakMap<ArtistRecord[], ArtKpis>();

export function getArtKpis(artists: ArtistRecord[] | undefined): ArtKpis {
  if (!artists || artists.length === 0) return EMPTY_ART;
  let kpis = artCache.get(artists);
  if (kpis) return kpis;

  let totalViews = 0;
  const srcCounts = new Map<string, number>();
  for (const a of artists) {
    totalViews += a.totalViews ?? 0;
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

  kpis = {
    total: artists.length,
    avgViews: Math.round(totalViews / artists.length),
    topSource,
  };
  artCache.set(artists, kpis);
  return kpis;
}

// ---------------------------------------------------------------------------
// Trends page auxiliary: title -> link lookup map
// ---------------------------------------------------------------------------

const titleLinkMapCache = new WeakMap<ContentRecord[], Map<string, string>>();

export function getTitleLinkMap(records: ContentRecord[] | undefined): Map<string, string> {
  if (!records || records.length === 0) return new Map();
  let map = titleLinkMapCache.get(records);
  if (map) return map;
  map = new Map();
  for (const r of records) {
    if (r.link && r.title) map.set(r.title.toLowerCase(), r.link);
  }
  titleLinkMapCache.set(records, map);
  return map;
}
