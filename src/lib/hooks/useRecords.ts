'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchAllRecords } from '@/lib/firebase/firestore';
import type { ContentRecord } from '@/lib/types';

export function useRecords() {
  return useQuery<ContentRecord[]>({
    queryKey: ['records'],
    queryFn: fetchAllRecords,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFilteredRecords(filters: {
  types?: string[];
  sources?: string[];
  search?: string;
}) {
  const { data: allRecords, ...rest } = useRecords();

  const filtered = allRecords?.filter((r) => {
    if (filters.types?.length && !filters.types.includes(r.type)) return false;
    if (filters.sources?.length && !filters.sources.includes(r.source)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!r.name?.toLowerCase().includes(q) && !r.title?.toLowerCase().includes(q)) return false;
    }
    return true;
  }) ?? [];

  return { data: filtered, allRecords, ...rest };
}
