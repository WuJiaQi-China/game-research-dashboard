'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllRecords } from '@/lib/firebase/firestore';
import type { ContentRecord } from '@/lib/types';

export function useRecords() {
  return useQuery<ContentRecord[]>({
    queryKey: ['records'],
    queryFn: fetchAllRecords,
    staleTime: Infinity,
  });
}

export function useFilteredRecords(filters: {
  types?: string[];
  sources?: string[];
  search?: string;
}) {
  const { data: allRecords, ...rest } = useRecords();

  // Memoize on primitive fields (not the filter object reference) so a
  // caller passing `{...}` each render doesn't invalidate downstream memos.
  const typesKey = filters.types?.join('|') ?? '';
  const sourcesKey = filters.sources?.join('|') ?? '';
  const searchKey = filters.search ?? '';

  const filtered = useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter((r) => {
      if (filters.types?.length && !filters.types.includes(r.type)) return false;
      if (filters.sources?.length && !filters.sources.includes(r.source)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!r.name?.toLowerCase().includes(q) && !r.title?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecords, typesKey, sourcesKey, searchKey]);

  return { data: filtered, allRecords, ...rest };
}
