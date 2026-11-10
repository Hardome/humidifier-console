import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 3000 },
    mutations: { retry: false },
  },
});

interface AppProvidersProperties {
  readonly children: ReactNode;
}

export function AppProviders({ children }: Readonly<AppProvidersProperties>) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
