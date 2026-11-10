import { useState } from 'react';

import { HistoryChart } from '@widgets/history';
import { Controls } from '@features/commands';
import { historySettings, useDevice, useHistory } from '@entities/humidifier';
import { dateTime, errorMessage } from '@shared/lib/format';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure, NoData } from '@shared/ui/feedback';
import { Skeleton } from '@shared/ui/skeleton';

import { DeviceDetails } from './device-details';
import { DeviceHero } from './device-hero';
import { DeviceMetrics } from './device-metrics';

export function OverviewPage() {
  const device = useDevice();

  const [historyStart] = useState(() => new Date(Date.now() - historySettings.overviewPeriodMs).toISOString());

  const history = useHistory({ start: historyStart }, { refetchInterval: historySettings.overviewRefreshMs });

  const state = device.data;

  return (
    <div className="flex flex-col gap-[22px]">
      {device.error && <Failure error={device.error} />}
      {state?.stale && (
        <Alert>
          <AlertTitle>Показания устарели</AlertTitle>
          <AlertDescription>
            {state.error ? errorMessage({ code: state.error }) : 'Ожидаем первый ответ устройства.'} Последнее
            измерение: {dateTime(state.measured_at)}.
          </AlertDescription>
        </Alert>
      )}
      {state && !state.database_ok && (
        <Alert variant="destructive">
          <AlertTitle>История временно недоступна</AlertTitle>
          <AlertDescription>Нет соединения с базой данных. Фоновые команды приостановлены.</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] items-start gap-[22px] max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-[22px]">
          <DeviceHero />

          <DeviceMetrics />
          <Card>
            <CardHeader>
              <CardTitle>Как менялся климат</CardTitle>
              <CardDescription>Последние измерения за сутки</CardDescription>
            </CardHeader>
            <CardContent>
              {history.error && (
                <Failure
                  error={history.error}
                  retry={() => {
                    void history.refetch();
                  }}
                />
              )}
              <DataRegion
                isLoading={history.isPending}
                isFetching={history.isFetching}
                skeleton={<Skeleton className="h-[440px] w-full max-[700px]:h-[380px]" />}
              >
                {!history.error &&
                  (history.data?.items.length ? (
                    <HistoryChart points={history.data.items} showHumidityGuide={false} />
                  ) : (
                    <NoData>
                      История начнёт накапливаться после запуска. Первое измерение сохраняется в конце минуты.
                    </NoData>
                  ))}
              </DataRegion>
            </CardContent>
          </Card>
          <DeviceDetails />
        </div>
        <Controls />
      </div>
    </div>
  );
}
