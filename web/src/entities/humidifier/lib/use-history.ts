import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { loadHistory } from './load-history';

interface HistoryRange {
  start: string;
  end?: string;
}

interface HistoryOptions {
  enabled?: boolean;
  refetchInterval?: number;
  keepPreviousData?: boolean;
}

export function useHistory(range: HistoryRange, options: HistoryOptions = {}) {
  return useQuery({
    enabled: options.enabled,
    queryKey: ['humidifier', 'history', range],
    queryFn: ({ signal }) => loadHistory(range, signal),
    refetchInterval: options.refetchInterval,
    placeholderData: options.keepPreviousData ? keepPreviousData : undefined,
  });
}
