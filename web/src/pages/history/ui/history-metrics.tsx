import { cn } from 'cn';

import type { HistoryStats } from '@api/types/HistoryStats';

interface HistoryMetricsProperties {
  readonly stats: HistoryStats | undefined;
}

export function HistoryMetrics({ stats }: HistoryMetricsProperties) {
  return (
    <div className="grid grid-cols-3 gap-[18px] max-[700px]:gap-2">
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          Минимальная влажность
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {stats?.humidity_min?.toFixed(1) ?? '—'}
          <small>%</small>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          Средняя / максимальная
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {stats?.humidity_mean?.toFixed(1) ?? '—'}
          <small>/ {stats?.humidity_max?.toFixed(1) ?? '—'}%</small>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 max-[700px]:px-2.5 max-[700px]:py-3.5">
        <div className="flex items-center gap-2 text-xs text-metric-label max-[700px]:gap-[5px] max-[700px]:text-[10px] [&>svg]:size-[17px]">
          Наблюдаемая работа
        </div>
        <div
          className={cn(
            'mt-3 text-[37px] font-medium tracking-[-1.7px] max-[700px]:text-[29px] [&>small]:ml-[5px]',
            '[&>small]:text-[17px] [&>small]:tracking-normal [&>small]:text-metric-unit',
          )}
        >
          {((stats?.power_seconds ?? 0) / 3600).toFixed(1)}
          <small>ч</small>
        </div>
      </div>
    </div>
  );
}
