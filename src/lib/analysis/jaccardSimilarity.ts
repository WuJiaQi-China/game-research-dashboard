import type { ContentRecord } from '@/lib/types';

export interface SimilarArtist {
  record: ContentRecord;
  score: number;
  commonTags: string[];
}

export function findSimilarArtists(
  targetTags: string[],
  allArtists: ContentRecord[],
  excludeId: string,
  topN: number = 4
): SimilarArtist[] {
  const targetSet = new Set(targetTags.map(t => t.toLowerCase()));
  if (targetSet.size === 0) return [];

  const scored: SimilarArtist[] = [];

  for (const artist of allArtists) {
    if (artist.id === excludeId) continue;
    const otherTags = artist.tags ?? [];
    if (!otherTags.length) continue;

    const otherSet = new Set(otherTags.map(t => t.toLowerCase()));
    const common = [...targetSet].filter(t => otherSet.has(t));
    const union = new Set([...targetSet, ...otherSet]);

    if (common.length > 0 && union.size > 0) {
      scored.push({
        record: artist,
        score: common.length / union.size,
        commonTags: common,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}
