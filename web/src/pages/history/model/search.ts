import { z } from 'zod';

import { historySettings } from '@entities/humidifier';
import { Duration } from '@shared/lib/time';

export const historySearchSchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month', 'custom']).catch('day'),
  metric: z.enum(['humidity', 'temperature', 'speed', 'status']).catch('humidity'),
  eventOffset: z.coerce.number().int().nonnegative().catch(0),
  start: z.iso.datetime().optional().catch(undefined),
  end: z.iso.datetime().optional().catch(undefined),
});

export const periods = { hour: 1, day: 24, week: 168, month: 720 };

export function historyRange(search: z.infer<typeof historySearchSchema>, now: number) {
  const end = search.end ?? new Date(now).toISOString();
  const start =
    search.start ??
    new Date(now - periods[search.period === 'custom' ? 'day' : search.period] * Duration.Hour).toISOString();

  return { start, end };
}

export function isHistoryRangeValid(range: { start: string; end: string }) {
  const duration = Date.parse(range.end) - Date.parse(range.start);

  return duration > 0 && duration <= historySettings.maximumRangeDays * Duration.Day;
}
