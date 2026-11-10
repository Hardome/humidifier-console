import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';

import { dateTime } from '@shared/lib/format';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardFooter } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure, NoData } from '@shared/ui/feedback';
import { Field, FieldGroup, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';
import { NativeSelect } from '@shared/ui/native-select';
import { Skeleton } from '@shared/ui/skeleton';

import { useGetEvents } from '@api/hooks/useGetEvents';

import { eventsSearchSchema, eventsSettings, getEventsQuery } from '../model/search';

export const sources: Record<string, string> = {
  panel: 'Панель',
  api: 'API',
  schedule: 'Расписание',
  automation: 'Автоматизация',
  external: 'Внешнее / неизвестное',
};

export function EventsPage() {
  const filters = eventsSearchSchema.parse(useSearch({ strict: false }));
  const offset = filters.offset;

  const navigate = useNavigate({ from: '/events' });

  const isRangeValid = !filters.start || !filters.end || Date.parse(filters.start) <= Date.parse(filters.end);

  const data = useGetEvents(
    { query: getEventsQuery(filters) },
    {
      query: { refetchInterval: eventsSettings.refreshMs, placeholderData: keepPreviousData, enabled: isRangeValid },
    },
  );

  const filter = (key: 'type' | 'source' | 'start' | 'end', value: string) => {
    void navigate({ search: { ...filters, [key]: value, offset: 0 } });
  };

  const setOffset = (next: number) => {
    void navigate({ search: { ...filters, offset: next } });
  };

  return (
    <Card>
      <CardContent>
        <FieldGroup className="mb-6">
          <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
            <Field>
              <FieldLabel htmlFor="event-type">Тип</FieldLabel>
              <NativeSelect
                id="event-type"
                value={filters.type}
                onChange={(event) => filter('type', event.target.value)}
              >
                <option value="">Все события</option>
                {[
                  ['command', 'Команды'],
                  ['command_unknown', 'Неизвестный результат'],
                  ['state', 'Состояние'],
                  ['fault', 'Ошибки'],
                  ['connection', 'Связь'],
                  ['cleaning', 'Очистка'],
                  ['verification', 'Проверки'],
                  ['humidity', 'Влажность'],
                  ['washing', 'Мойка'],
                ].map(([optionValue, optionLabel]) => (
                  <option key={optionValue} value={optionValue}>
                    {optionLabel}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="event-source">Источник</FieldLabel>
              <NativeSelect
                id="event-source"
                value={filters.source}
                onChange={(event) => filter('source', event.target.value)}
              >
                <option value="">Все источники</option>
                {Object.entries(sources).map(([optionValue, optionLabel]) => (
                  <option key={optionValue} value={optionValue}>
                    {optionLabel}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="event-start">С</FieldLabel>
              <Input
                id="event-start"
                type="datetime-local"
                value={filters.start}
                onChange={(event) => filter('start', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="event-end">По</FieldLabel>
              <Input
                id="event-end"
                type="datetime-local"
                value={filters.end}
                onChange={(event) => filter('end', event.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>
        {!isRangeValid && (
          <p role="alert" className="text-error">
            Начало диапазона должно быть раньше конца.
          </p>
        )}
        {data.error && (
          <Failure
            error={data.error}
            retry={() => {
              void data.refetch();
            }}
          />
        )}
        <DataRegion
          isLoading={data.isPending && isRangeValid}
          isFetching={data.isFetching}
          isRefreshing={data.isPlaceholderData && data.isFetching}
          skeleton={<Skeleton className="h-52 w-full" />}
        >
          {data.data?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border-b border-border p-3 text-left font-medium text-table-heading">Время</th>
                    <th className="border-b border-border p-3 text-left font-medium text-table-heading">Событие</th>
                    <th className="border-b border-border p-3 text-left font-medium text-table-heading">Источник</th>
                    <th className="border-b border-border p-3 text-left font-medium text-table-heading">Подробности</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((event) => (
                    <tr key={event.id}>
                      <td className="border-b border-table-border px-3 py-[13px] align-top">{dateTime(event.at)}</td>
                      <td className="border-b border-table-border px-3 py-[13px] align-top">{event.message}</td>
                      <td className="border-b border-table-border px-3 py-[13px] align-top">
                        {sources[event.source] ?? event.source}
                      </td>
                      <td className="border-b border-table-border px-3 py-[13px] align-top">
                        <details>
                          <summary className="cursor-pointer">Показать</summary>
                          <pre className="max-w-72 overflow-auto text-[10px]">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData title="Событий не найдено">Попробуйте изменить фильтры.</NoData>
          )}
        </DataRegion>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-[11px] leading-[1.6] text-hint">Всего: {data.data?.total ?? 0}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!offset || data.isFetching}
            onClick={() => setOffset(Math.max(0, offset - eventsSettings.pageSize))}
          >
            Назад
          </Button>
          <Button
            variant="outline"
            disabled={data.isFetching || offset + eventsSettings.pageSize >= (data.data?.total ?? 0)}
            onClick={() => setOffset(offset + eventsSettings.pageSize)}
          >
            Далее
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
