import type { UseFormReturn } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

import { Field, FieldLabel, FieldLegend, FieldSet } from '@shared/ui/field';
import { Input } from '@shared/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import type { RuleInput } from '@api/types';

import { weekdayOptions } from '../model/weekdays';

interface ScheduleFieldsProperties {
  readonly form: UseFormReturn<RuleInput>;
}

export function ScheduleFields({ form }: Readonly<ScheduleFieldsProperties>) {
  const days = useWatch({ control: form.control, name: 'config.days' }) ?? [];

  return (
    <>
      <Field>
        <FieldLabel htmlFor="rule-time">Время в часовом поясе приложения</FieldLabel>
        <Input id="rule-time" type="time" required {...form.register('config.time')} />
      </Field>
      <FieldSet>
        <FieldLegend>Дни недели</FieldLegend>
        <ToggleGroup
          aria-label="Дни недели"
          multiple
          value={days.map(String)}
          variant="outline"
          spacing={0}
          className="w-full [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:flex-1"
          onValueChange={(values) => form.setValue('config.days', values.map(Number))}
        >
          {weekdayOptions.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={String(value)} className="px-1">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldSet>
    </>
  );
}
