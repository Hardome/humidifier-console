import { getHistory } from '@api/clients/getHistory';

import { historySettings } from '../model/history-settings';

export async function loadHistory(range: { start: string; end?: string }, signal?: AbortSignal) {
  const first = await getHistory({
    query: { ...range, limit: historySettings.pageSize },
    signal,
  }).unwrap();
  const items = [...first.items];

  for (let offset = historySettings.pageSize; offset < first.total; offset += historySettings.pageSize) {
    const page = await getHistory({
      query: { ...range, limit: historySettings.pageSize, offset },
      signal,
    }).unwrap();
    items.push(...page.items);
  }

  return { ...first, items, range };
}
