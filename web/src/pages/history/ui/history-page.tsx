import { useState } from 'react';

import { useNavigate, useSearch } from '@tanstack/react-router';

import { HistoryChart } from '@widgets/history';
import { useHistory } from '@entities/humidifier';
import { dateTime } from '@shared/lib/format';
import { Duration } from '@shared/lib/time';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure, NoData } from '@shared/ui/feedback';
import { Skeleton } from '@shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import { useGetEvents } from '@api/hooks/useGetEvents';

import { historyRange, historySearchSchema, isHistoryRangeValid, periods } from '../model/search';
import { HistoryEvents } from './history-events';
import { HistoryMetrics } from './history-metrics';
import { HistoryRangeForm } from './history-range-form';

export function HistoryPage() {
  const search = historySearchSchema.parse(useSearch({ strict: false }));

  const navigate = useNavigate({ from: '/history' });

  const { period, metric } = search;

  const [now] = useState(Date.now);

  const range = historyRange(search, now);
  const isRangeValid = isHistoryRangeValid(range);

  const setMetric = (next: typeof metric) => {
    void navigate({ search: { ...search, metric: next } });
  };

  const setRange = (next: { start: string; end: string }) => {
    void navigate({ search: { ...search, ...next, period: 'custom', eventOffset: 0 } });
  };

  const data = useHistory(range, { keepPreviousData: true, enabled: isRangeValid });

  const events = useGetEvents({ query: { ...range, limit: 100 } }, { query: { enabled: isRangeValid } });

  const stats = data.data?.stats;

  return (
    <div className="flex flex-col gap-[22px]">
      <ToggleGroup
        aria-label="Период истории"
        value={[period]}
        onValueChange={(selectedValues) => {
          if (selectedValues.length === 0) {
            return;
          }

          const next = selectedValues[0];

          if (next === 'custom') {
            void navigate({ search: { ...search, period: next, eventOffset: 0 } });

            return;
          }

          if (!Object.hasOwn(periods, next)) {
            return;
          }

          void navigate({
            search: {
              ...search,
              period: next as keyof typeof periods,
              eventOffset: 0,
              start: new Date(now - periods[next as keyof typeof periods] * Duration.Hour).toISOString(),
              end: new Date(now).toISOString(),
            },
          });
        }}
        variant="outline"
        className="flex-wrap"
      >
        {[
          ['hour', 'Час'],
          ['day', 'Сутки'],
          ['week', 'Неделя'],
          ['month', 'Месяц'],
          ['custom', 'Свой диапазон'],
        ].map(([optionValue, optionLabel]) => (
          <ToggleGroupItem key={optionValue} value={optionValue}>
            {optionLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {period === 'custom' && <HistoryRangeForm onSubmit={setRange} />}
      {!isRangeValid && (
        <p role="alert" className="text-error">
          Начало должно быть раньше конца; максимальный диапазон — 366 дней.
        </p>
      )}
      <HistoryMetrics stats={isRangeValid ? stats : undefined} />
      <Card>
        <CardHeader>
          <CardTitle>История климата</CardTitle>
          <CardDescription>
            {dateTime(data.data?.range.start ?? range.start)} — {dateTime(data.data?.range.end ?? range.end)}. Разрывы
            означают отсутствие измерений.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            aria-label="Показатель"
            value={[metric]}
            onValueChange={(selectedValues) => {
              if (selectedValues.length > 0) {
                setMetric(selectedValues[0] as typeof metric);
              }
            }}
            variant="outline"
            className="mb-5 flex-wrap"
          >
            {[
              ['humidity', 'Влажность'],
              ['temperature', 'Температура'],
              ['speed', 'Скорость, об/мин'],
              ['status', 'Работа'],
            ].map(([optionValue, optionLabel]) => (
              <ToggleGroupItem key={optionValue} value={optionValue}>
                {optionLabel}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
            skeleton={<Skeleton className="h-60 w-full" />}
          >
            {isRangeValid &&
              (data.data?.items.length ? (
                <HistoryChart points={data.data.items} metric={metric} events={events.data?.items} />
              ) : (
                <NoData />
              ))}
          </DataRegion>
        </CardContent>
      </Card>
      <HistoryEvents
        range={range}
        enabled={isRangeValid}
        offset={search.eventOffset}
        onOffset={(eventOffset) => {
          void navigate({ search: { ...search, eventOffset } });
        }}
      />
    </div>
  );
}
