'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 30000,
        fetcher: (url: string) => fetch(url).then(res => res.json()),
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
