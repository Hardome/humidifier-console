import { cn } from 'cn';
import { Droplets, Thermometer, Waves } from 'lucide-react';

import type { WaterCode } from '@entities/humidifier';
import { useDevice, useSettings } from '@entities/humidifier';
import { Skeleton } from '@shared/ui/skeleton';

export function DeviceMetrics() {
  const device = useDevice();

  const settings = useSettings();

  const state = device.data;
  const readings = state?.values;
  const waterLabel = readings ? settings.data?.water_labels[String(readings.water_code) as WaterCode] : undefined;
  const waterDescription =
    ({ low: 'Мало воды', normal: 'Воды достаточно' } as Record<string, string>)[waterLabel ?? ''] ??
    'Значение требует проверки';

  return device.isPending ? (
    <Skeleton className="h-32 w-full" />
  ) : (
    <div className="grid grid-cols-3 gap-[18px] max-[700px]:gap-2">
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          <Droplets />
          Влажность
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {readings?.humidity ?? '—'}
          <small>%</small>
        </div>
        <span className="text-[11px] leading-[1.6] text-hint">Цель {readings?.target_humidity ?? '—'}%</span>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          <Thermometer />
          Температура
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {readings?.temperature ?? '—'}
          <small>°C</small>
        </div>
        <span className="text-[11px] leading-[1.6] text-hint">В комнате</span>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          <Waves />
          Вода · код
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {readings?.water_code ?? '—'}
        </div>
        <span className="text-[11px] leading-[1.6] text-hint">{waterDescription}</span>
      </div>
    </div>
  );
}
