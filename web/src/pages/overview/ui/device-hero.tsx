import { cn } from 'cn';

import { useDevice } from '@entities/humidifier';
import { Badge } from '@shared/ui/badge';

import { DeviceIllustration } from './device-illustration';

export function DeviceHero() {
  const device = useDevice();

  const state = device.data;
  const onlineLabel = state?.online && !state.stale ? 'В локальной сети' : 'Нет свежих показаний';

  return (
    <section
      className={cn(
        'relative flex min-h-[222px] items-center justify-between overflow-hidden rounded-xl border',
        'border-hero-border bg-hero px-[30px] py-7 max-[700px]:min-h-[210px] max-[700px]:px-5',
        'max-[700px]:py-6',
      )}
    >
      <div>
        <div className="text-[10px] font-bold tracking-[2px] text-eyebrow uppercase">Smartmi Evaporative 3 Lite</div>
        <h2 className="mt-4 mb-2 text-[25px] font-medium tracking-[-0.6px] max-[700px]:text-[22px]">
          Комфорт начинается
          <br />с правильного воздуха
        </h2>
        <Badge variant="outline">{onlineLabel}</Badge>
      </div>
      <DeviceIllustration humidity={state?.values?.humidity} />
    </section>
  );
}
