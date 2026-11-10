import { useDevice } from '@entities/humidifier';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Failure } from '@shared/ui/feedback';

import { useGetDiagnostics } from '@api/hooks/useGetDiagnostics';

export function DeviceDiagnostics() {
  const device = useDevice();

  const diagnostics = useGetDiagnostics();

  const databaseStatus = diagnostics.data?.database_ok ? 'Доступна' : 'Недоступна';

  return (
    <Card>
      <CardHeader>
        <CardTitle>О приборе и соединении</CardTitle>
      </CardHeader>
      <CardContent>
        {diagnostics.error && <Failure error={diagnostics.error} />}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <dt>Модель</dt>
          <dd>{device.data?.device.model ?? '—'}</dd>
          <dt>Прошивка</dt>
          <dd>{device.data?.device.firmware ?? '—'}</dd>
          <dt>Аппаратная версия</dt>
          <dd>{device.data?.device.hardware ?? '—'}</dd>
          <dt>Код рынка (только чтение)</dt>
          <dd>{device.data?.values?.country_code ?? '—'}</dd>
          <dt>Ошибок связи подряд</dt>
          <dd>{diagnostics.data?.consecutive_failures ?? '—'}</dd>
          <dt>База данных</dt>
          <dd>{diagnostics.data ? databaseStatus : 'Нет данных'}</dd>
          <dt>Без интернета прибора</dt>
          <dd>Аппаратная проверка ещё не выполнена</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
