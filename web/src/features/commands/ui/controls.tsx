import {
  brightnessLabels,
  CapabilityStatus,
  CleaningDisplay,
  CommandSource,
  DeviceProperty,
  HumidifierMode,
  labels,
  modes,
  powerLevels,
  useCapabilities,
  useDevice,
} from '@entities/humidifier';
import { BinaryControl } from '@shared/ui/binary-control';
import { Card, CardContent, CardFooter } from '@shared/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@shared/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import type { CommandInput } from '@api/types/CommandInput';

import { useCommand } from '../lib/use-command';
import { CommandFeedback } from './command-feedback';
import { TargetHumidityControl } from './target-humidity-control';

const modeDescriptions: Record<number, string> = {
  [HumidifierMode.Sleep]: 'Ночной режим для использования во время сна.',
  [HumidifierMode.Favorite]: 'Задайте мощность вручную в поле ниже.',
  [HumidifierMode.Auto]: 'Прибор автоматически подбирает работу для заданной влажности.',
};

export function Controls() {
  const { data } = useDevice();

  const capabilities = useCapabilities();

  const command = useCommand();

  const value = data?.values;
  const isDisabled = (name: string) =>
    !data ||
    data.stale ||
    command.busy ||
    !capabilities.data?.items.some(
      (capability) => capability.name === name && capability.status === CapabilityStatus.verified,
    );
  const send = (name: CommandInput['name'], next: CommandInput['value']) =>
    command.send({ name, value: next, source: CommandSource.panel });

  return (
    <Card>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Питание</FieldLabel>
            <BinaryControl
              label="Питание"
              isOn={value?.power}
              disabled={isDisabled(DeviceProperty.power)}
              onChange={(next) => send(DeviceProperty.power, next)}
            />
          </Field>
          <Field>
            <FieldLabel>Режим работы</FieldLabel>
            <ToggleGroup
              aria-label="Режим работы"
              value={value ? [String(value.mode)] : []}
              onValueChange={(selectedValues) => {
                if (selectedValues.length > 0) {
                  send(DeviceProperty.mode, Number(selectedValues[0]));
                }
              }}
              disabled={isDisabled(DeviceProperty.mode)}
              variant="outline"
              spacing={0}
              className="w-full flex-wrap [&>button]:min-h-11 [&>button]:flex-1"
            >
              {Object.entries(modes).map(([id, label]) => (
                <ToggleGroupItem key={id} value={id} className="min-w-0 px-1 text-xs break-words whitespace-normal">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {value && modeDescriptions[value.mode] && (
              <FieldDescription>{modeDescriptions[value.mode]}</FieldDescription>
            )}
          </Field>
          <TargetHumidityControl
            currentValue={value?.target_humidity}
            disabled={isDisabled(DeviceProperty.target_humidity)}
            onSubmit={(humidity) => send(DeviceProperty.target_humidity, humidity)}
          />
          <Field>
            <FieldLabel>Экран</FieldLabel>
            <ToggleGroup
              aria-label="Яркость экрана"
              value={value ? [String(value.brightness)] : []}
              onValueChange={(selectedValues) => {
                if (selectedValues.length > 0) {
                  send(DeviceProperty.brightness, Number(selectedValues[0]));
                }
              }}
              disabled={isDisabled(DeviceProperty.brightness)}
              variant="outline"
              spacing={0}
              className="w-full [&>button]:min-h-11 [&>button]:flex-1"
            >
              {Object.entries(brightnessLabels).map(([id, label]) => (
                <ToggleGroupItem key={label} value={id}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          {(
            [DeviceProperty.auto_dry, DeviceProperty.child_lock, DeviceProperty.sound, DeviceProperty.clean] as const
          ).map((name) => (
            <Field key={name}>
              <FieldLabel>{labels[name]}</FieldLabel>
              <BinaryControl
                label={labels[name]}
                isOn={value?.[name]}
                disabled={isDisabled(name)}
                onChange={(next) => send(name, next)}
              />
            </Field>
          ))}
          <Field>
            <FieldLabel>Пользовательская мощность</FieldLabel>
            <ToggleGroup
              aria-label="Пользовательская мощность"
              variant="outline"
              spacing={0}
              className="w-full [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:flex-1"
              disabled={isDisabled(DeviceProperty.level)}
              value={value ? [String(value.level)] : []}
              onValueChange={(selectedValues) => {
                if (selectedValues.length > 0) {
                  send(DeviceProperty.level, Number(selectedValues[0]));
                }
              }}
            >
              {powerLevels.map((powerLevel) => (
                <ToggleGroupItem key={powerLevel} value={String(powerLevel)} aria-label={`Уровень ${powerLevel}`}>
                  {powerLevel}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel>Индикация завершения очистки</FieldLabel>
            <BinaryControl
              label="Индикация завершения очистки"
              isOn={value == null ? undefined : value.clean_end_display === CleaningDisplay.Visible}
              disabled={isDisabled(DeviceProperty.clean_end_display)}
              onChange={(next) =>
                send(DeviceProperty.clean_end_display, next ? CleaningDisplay.Visible : CleaningDisplay.Hidden)
              }
            />
          </Field>
        </FieldGroup>
        <CommandFeedback command={command} />
      </CardContent>
      <CardFooter>
        <p className="text-[11px] leading-[1.6] text-hint">
          Недоступные функции можно проверить в настройках.
          <br />
          Ручная команда временно приостанавливает автоматизации.
        </p>
      </CardFooter>
    </Card>
  );
}
