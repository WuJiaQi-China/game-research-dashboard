'use client';
import { useMemo } from 'react';
import { useRecords } from './useRecords';
import type { ContentRecord, ArtistRecord } from '@/lib/types';

export function useArtists() {
  const { data, ...rest } = useRecords();

  const artists = useMemo(() => {
    if (!data) return [];
    return data.filter((r): r is ArtistRecord => r.type === 'artist');
  }, [data]);

  return { data: artists, ...rest };
}

// Normalize across platforms and get top N
export function useTopArtists(topN: number = 20) {
  const { data: artists, ...rest } = useArtists();

  const topArtists = useMemo(() => {
    if (!artists.length) return [];

    // Per-platform min-max normalization
    const withScore = artists.map(a => ({ ...a, _normScore: 0 }));
    const sources = [...new Set(artists.map(a => a.source))];

    for (const src of sources) {
      const group = withScore.filter(a => a.source === src);
      const views = group.map(a => a.totalViews || a.totalBookmarks || 0);
      const min = Math.min(...views);
      const max = Math.max(...views);
      for (const a of group) {
        const v = a.totalViews || a.totalBookmarks || 0;
        a._normScore = max > min ? (v - min) / (max - min) : (max > 0 ? 1 : 0);
      }
    }

    return withScore
      .sort((a, b) => b._normScore - a._normScore)
      .slice(0, topN);
  }, [artists, topN]);

  return { data: topArtists, ...rest };
}
