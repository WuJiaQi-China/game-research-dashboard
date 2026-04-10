'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConfig, saveConfig } from '@/lib/firebase/firestore';
import type { ScrapeConfig } from '@/lib/types';

export function useConfig() {
  return useQuery<ScrapeConfig | null>({
    queryKey: ['scrapeConfig'],
    queryFn: async () => {
      try {
        return await fetchConfig();
      } catch (e) {
        console.warn('Failed to fetch config from Firestore:', e);
        return null;
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<ScrapeConfig>) => {
      try {
        await saveConfig(config);
      } catch (e) {
        console.warn('Failed to save config to Firestore:', e);
        // Save locally as fallback
        localStorage.setItem('scrapeConfig', JSON.stringify(config));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrapeConfig'] }),
  });
}
