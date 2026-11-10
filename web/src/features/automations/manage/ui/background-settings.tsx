import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CapabilityStatus, DeviceProperty, useCapabilities, useSettings } from '@entities/humidifier';
import { dateTime } from '@shared/lib/format';
import { Duration } from '@shared/lib/time';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Failure } from '@shared/ui/feedback';
import { Field, FieldGroup, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';

import { updateSettings } from '@api/clients';
import type { SettingsInput } from '@api/types';
import { settingsInputSchema } from '@api/zod/settingsInputSchema';

import { timerSettings } from '../model/editor-settings';

export function BackgroundSettings() {
  const [timerMinutes, setTimerMinutes] = useState<number>(timerSettings.defaultMinutes);

  const settings = useSettings();

  const capabilities = useCapabilities();

  const isVerified = (name: string) =>
    !!capabilities.data?.items.some(
      (capability) => capability.name === name && capability.status === CapabilityStatus.verified,
    );

  const client = useQueryClient();

  const mutate = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => client.invalidateQueries(),
  });

  const patch = (changes: Partial<SettingsInput>) => {
    if (!settings.data) {
      return;
    }

    const body = settingsInputSchema.strip().parse(settings.data);
    mutate.mutate(() => updateSettings({ body: { ...body, ...changes } }).unwrap());
  };

  const paused = settings.data?.pause_until && new Date(settings.data.pause_until) > new Date();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Фоновое управление</CardTitle>
          <CardDescription>Ручная команда временно приостанавливает расписания и правила влажности</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="outline">{paused ? 'На паузе' : 'Активно'}</Badge>
              <p className="text-[11px] leading-[1.6] text-hint">
                {paused ? `До ${dateTime(settings.data?.pause_until)}` : 'Выполняются только включённые правила'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={mutate.isPending || !settings.data}
                onClick={() =>
                  patch({
                    pause_until: new Date(Date.now() + Duration.Hour).toISOString(),
                  })
                }
              >
                Пауза на час
              </Button>
              <Button disabled={mutate.isPending || !paused} onClick={() => patch({ pause_until: null })}>
                Возобновить
              </Button>
            </div>
          </div>
          <FieldGroup className="mt-5">
            <Field>
              <FieldLabel htmlFor="timer-minutes">Таймер выключения, минут</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="timer-minutes"
                  type="number"
                  min={timerSettings.minimumMinutes}
                  max={timerSettings.maximumMinutes}
                  value={timerMinutes}
                  onChange={(event) => setTimerMinutes(Number(event.target.value))}
                />
                <Button
                  disabled={
                    mutate.isPending ||
                    !Number.isSafeInteger(timerMinutes) ||
                    timerMinutes < timerSettings.minimumMinutes ||
                    timerMinutes > timerSettings.maximumMinutes ||
                    !settings.data ||
                    !isVerified(DeviceProperty.power)
                  }
                  onClick={() =>
                    patch({
                      off_timer: new Date(Date.now() + timerMinutes * Duration.Minute).toISOString(),
                    })
                  }
                >
                  Установить
                </Button>
                <Button
                  variant="outline"
                  disabled={!settings.data?.off_timer || mutate.isPending}
                  onClick={() => patch({ off_timer: null })}
                >
                  Отменить
                </Button>
              </div>
            </Field>
            <p className="text-[11px] leading-[1.6] text-hint">
              {settings.data?.off_timer ? `Выключение: ${dateTime(settings.data.off_timer)}` : 'Таймер не установлен'}.
              При потере связи просроченный таймер выполнится после восстановления.
            </p>
          </FieldGroup>
        </CardContent>
      </Card>
      {mutate.error && <Failure error={mutate.error} />}
    </>
  );
}
