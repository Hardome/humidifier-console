import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { waterCodes } from '@entities/humidifier';
import { BinaryControl } from '@shared/ui/binary-control';
import { Button } from '@shared/ui/button';
import { Failure } from '@shared/ui/feedback';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@shared/ui/field';
import { Input } from '@shared/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import { updateSettings } from '@api/clients';
import type { Settings, SettingsInput } from '@api/types';
import { waterLabels0Enum } from '@api/types/WaterLabels';
import { settingsInputSchema } from '@api/zod/settingsInputSchema';

interface SettingsFormProperties {
  readonly settings: Settings;
}

export function SettingsForm({ settings }: Readonly<SettingsFormProperties>) {
  const client = useQueryClient();

  const initial = settingsInputSchema.strip().parse(settings);

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsInputSchema),
    defaultValues: initial,
  });

  const save = useMutation({
    mutationFn: (body: SettingsInput) => updateSettings({ body }).unwrap(),
    onSuccess: () => client.invalidateQueries(),
  });

  const notifications = useWatch({ control: form.control, name: 'notifications' });
  const waterLabels = useWatch({ control: form.control, name: 'water_labels' });

  const categories = notifications.categories;

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit((body) => save.mutate(body))(event);
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
          {(
            [
              ['timezone', 'Часовой пояс', 'text'],
              ['retention_days', 'Хранить историю, дней', 'number'],
              ['manual_pause_minutes', 'Пауза после ручной команды, минут', 'number'],
              ['minimum_switch_seconds', 'Минимум между переключениями, секунд', 'number'],
            ] as const
          ).map(([name, label, type]) => (
            <Field key={name} data-invalid={Object.hasOwn(form.formState.errors, name)}>
              <FieldLabel htmlFor={`settings-${name}`}>{label}</FieldLabel>
              <Input
                id={`settings-${name}`}
                type={type}
                aria-invalid={Object.hasOwn(form.formState.errors, name)}
                {...form.register(name, { valueAsNumber: type === 'number' })}
              />
            </Field>
          ))}
        </div>
        <FieldSet>
          <FieldLegend>Уведомления</FieldLegend>
          <Field>
            <FieldLabel>Отправлять уведомления в Telegram</FieldLabel>
            <BinaryControl
              label="Отправлять уведомления в Telegram"
              isOn={notifications.enabled}
              disabled={save.isPending}
              onChange={(isOn) => form.setValue('notifications.enabled', isOn)}
            />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Категории</FieldLegend>
            <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
              {(
                [
                  ['fault', 'Ошибки'],
                  ['connection', 'Потеря связи'],
                  ['command_unknown', 'Неподтверждённая команда'],
                  ['cleaning', 'Очистка завершена'],
                  ['humidity', 'Границы влажности'],
                  ['no_growth', 'Нет роста влажности'],
                  ['washing', 'Напоминание о мойке'],
                  ['water', 'Мало воды (после проверки кодов)'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <BinaryControl
                    label={label}
                    disabled={save.isPending}
                    isOn={categories.includes(key)}
                    onChange={(isOn) =>
                      form.setValue(
                        'notifications.categories',
                        isOn ? [...categories, key] : categories.filter((category) => category !== key),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
          </FieldSet>
        </FieldSet>
        <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
          {(
            [
              ['humidity_low', 'Нижняя граница влажности, %'],
              ['humidity_high', 'Верхняя граница влажности, %'],
              ['no_growth_minutes', 'Без роста влажности, минут'],
              ['washing_days', 'Напоминать о мойке каждые, дней'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`notification-${key}`}>{label}</FieldLabel>
              <Input
                id={`notification-${key}`}
                type="number"
                value={notifications[key] ?? ''}
                onChange={(event) =>
                  form.setValue(`notifications.${key}`, event.target.value === '' ? null : Number(event.target.value))
                }
              />
              <span className="text-[11px] leading-[1.6] text-hint">Пустое значение отключает проверку</span>
            </Field>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => form.setValue('notifications.last_washed', new Date().toISOString())}
        >
          Отметить мойку сегодня
        </Button>
        <FieldSet>
          <FieldLegend>Проверенные коды воды</FieldLegend>
          <p className="text-[11px] leading-[1.6] text-hint">
            Назначайте подписи только после наблюдения за реальным уровнем воды.
          </p>
          {waterCodes.map((code) => (
            <Field key={code}>
              <FieldLabel>Код {code}</FieldLabel>
              <ToggleGroup
                aria-label={`Код ${code}`}
                value={[waterLabels[code]]}
                variant="outline"
                spacing={0}
                disabled={save.isPending}
                className="w-full [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:flex-1"
                onValueChange={(values) => {
                  const next = Object.values(waterLabels0Enum).find((option) => option === values[0]);

                  if (next) {
                    form.setValue(`water_labels.${code}`, next);
                  }
                }}
              >
                <ToggleGroupItem value={waterLabels0Enum.unknown} className="whitespace-normal">
                  Не проверен
                </ToggleGroupItem>
                <ToggleGroupItem value={waterLabels0Enum.low} className="whitespace-normal">
                  Мало воды
                </ToggleGroupItem>
                <ToggleGroupItem value={waterLabels0Enum.normal} className="whitespace-normal">
                  Воды достаточно
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          ))}
        </FieldSet>
        {Object.keys(form.formState.errors).length > 0 && (
          <p className="text-xs text-error">
            Проверьте значения: срок хранения 1–3650 дней, пауза 0–1440 минут, интервал переключений от 300 секунд.
          </p>
        )}
        {save.error && <Failure error={save.error} />}
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" disabled={save.isPending}>
            Сохранить настройки
          </Button>
          {save.isSuccess && (
            <span className="text-[11px] leading-[1.6] text-hint" aria-live="polite">
              Настройки сохранены
            </span>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}
