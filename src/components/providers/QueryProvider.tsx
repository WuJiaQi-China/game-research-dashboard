'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, ReactNode } from 'react';
import { fetchAllRecords } from '@/lib/firebase/firestore';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: Infinity,
            refetchOnWindowFocus: false,
            // v5 equivalent of keepPreviousData — don't flash empty on refetch
            placeholderData: (prev: unknown) => prev,
          },
        },
      }),
  );

  // Kick off the records fetch as early as possible so it overlaps with
  // UI bootstrap rather than blocking the first page mount.
  useEffect(() => {
    client.prefetchQuery({
      queryKey: ['records'],
      queryFn: fetchAllRecords,
      staleTime: 5 * 60 * 1000,
    });
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
