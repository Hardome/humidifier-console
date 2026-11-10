import { DeviceFault, modes, statuses, useDevice } from '@entities/humidifier';
import { dateTime } from '@shared/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';

export function DeviceDetails() {
  const device = useDevice();

  const state = device.data;
  const readings = state?.values;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Состояние устройства</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <dt>Работа</dt>
          <dd>{readings ? (statuses[readings.status] ?? `Код ${readings.status}`) : '—'}</dd>
          <dt>Режим</dt>
          <dd>{readings ? (modes[readings.mode] ?? readings.mode) : '—'}</dd>
          <dt>Скорость</dt>
          <dd>{readings?.speed ?? '—'} об/мин</dd>
          <dt>Ошибка</dt>
          <dd>{readings?.fault === DeviceFault.None ? 'Нет' : (readings?.fault ?? '—')}</dd>
          <dt>Время очистки</dt>
          <dd>{readings?.clean_minutes ?? '—'} мин</dd>
          <dt>Последнее измерение</dt>
          <dd>{dateTime(state?.measured_at)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
