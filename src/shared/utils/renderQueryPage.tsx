import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../styles/global.css';

export function renderQueryPage(page: React.ReactElement, staleTime: number): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime } },
  });

  const root = document.getElementById('root');
  if (!root) return;

  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      {page}
    </QueryClientProvider>,
  );
}
