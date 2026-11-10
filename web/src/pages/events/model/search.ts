import { z } from 'zod';

const localDate = z
  .string()
  .refine((value) => !value || Number.isFinite(Date.parse(value)))
  .catch('');

export const eventsSettings = { pageSize: 50, refreshMs: 10_000 } as const;

export const eventsSearchSchema = z.object({
  type: z.string().catch(''),
  source: z.string().catch(''),
  start: localDate,
  end: localDate,
  offset: z.coerce.number().int().nonnegative().catch(0),
});

export function getEventsQuery(search: z.infer<typeof eventsSearchSchema>) {
  return {
    limit: eventsSettings.pageSize,
    offset: search.offset,
    type: search.type || undefined,
    source: search.source || undefined,
    start: search.start ? new Date(search.start).toISOString() : undefined,
    end: search.end ? new Date(search.end).toISOString() : undefined,
  };
}
