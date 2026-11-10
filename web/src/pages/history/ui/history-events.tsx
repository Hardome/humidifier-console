import { keepPreviousData } from '@tanstack/react-query';

import { dateTime } from '@shared/lib/format';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure, NoData } from '@shared/ui/feedback';
import { Skeleton } from '@shared/ui/skeleton';

import { useGetEvents } from '@api/hooks/useGetEvents';

const pageSize = 10;

interface HistoryEventsProperties {
  readonly range: { start: string; end: string };
  readonly enabled: boolean;
  readonly offset: number;
  readonly onOffset: (offset: number) => void;
}

export function HistoryEvents({ range, enabled, offset, onOffset }: Readonly<HistoryEventsProperties>) {
  const events = useGetEvents(
    { query: { ...range, limit: pageSize, offset } },
    { query: { enabled, placeholderData: keepPreviousData } },
  );
  const total = events.data?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>События за период</CardTitle>
      </CardHeader>
      <CardContent>
        {Boolean(events.error) && <Failure error={events.error} />}
        <DataRegion
          isLoading={events.isPending && enabled}
          isFetching={events.isFetching}
          isRefreshing={events.isPlaceholderData && events.isFetching}
          skeleton={<Skeleton className="h-52 w-full" />}
        >
          {enabled &&
            !events.error &&
            (events.data?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-border p-3 text-left font-medium text-table-heading">Время</th>
                      <th className="border-b border-border p-3 text-left font-medium text-table-heading">Событие</th>
                      <th className="border-b border-border p-3 text-left font-medium text-table-heading">Источник</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.data.items.map((event) => (
                      <tr key={event.id}>
                        <td className="border-b border-table-border px-3 py-[13px] align-top">{dateTime(event.at)}</td>
                        <td className="border-b border-table-border px-3 py-[13px] align-top">{event.message}</td>
                        <td className="border-b border-table-border px-3 py-[13px] align-top">{event.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoData title="Событий за период нет" />
            ))}
        </DataRegion>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <span className="text-xs text-muted-foreground" role="status">
          {total ? `${offset + 1}–${Math.min(offset + pageSize, total)} из ${total}` : 'Всего: 0'}
        </span>
        <nav aria-label="Страницы событий за период" className="flex gap-2">
          <Button
            variant="outline"
            disabled={!enabled || !offset || events.isFetching}
            onClick={() => onOffset(Math.max(0, offset - pageSize))}
          >
            Назад
          </Button>
          <Button
            variant="outline"
            disabled={!enabled || events.isFetching || offset + pageSize >= total}
            onClick={() => onOffset(offset + pageSize)}
          >
            Далее
          </Button>
        </nav>
      </CardFooter>
    </Card>
  );
}
