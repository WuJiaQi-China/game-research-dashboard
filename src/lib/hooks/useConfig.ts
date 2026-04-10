'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConfig, saveConfig } from '@/lib/firebase/firestore';
import type { ScrapeConfig } from '@/lib/types';

export function useConfig() {
  return useQuery<ScrapeConfig | null>({
    queryKey: ['scrapeConfig'],
    queryFn: fetchConfig,
    staleTime: 30 * 1000,
  });
}

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<ScrapeConfig>) => saveConfig(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrapeConfig'] }),
  });
}
