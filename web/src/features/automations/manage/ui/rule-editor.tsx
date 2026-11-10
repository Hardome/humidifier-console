import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { CapabilityStatus, DeviceProperty, RuleKind, useCapabilities } from '@entities/humidifier';
import { BinaryControl } from '@shared/ui/binary-control';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Failure } from '@shared/ui/feedback';
import { Field, FieldGroup, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';

import type { RuleInput, RuleItem } from '@api/types';
import { ruleInputSchema } from '@api/zod/ruleInputSchema';

import { ruleEditorSettings } from '../model/editor-settings';
import { endpoints, type Kind, titles } from '../model/rules';
import { allWeekdays } from '../model/weekdays';
import { RuleActions } from './rule-actions';
import { ScheduleFields } from './schedule-fields';

interface RuleEditorProperties {
  readonly kind: Kind;
  readonly rule?: RuleItem;
  readonly close: () => void;
}

export function RuleEditor({ kind, rule, close }: Readonly<RuleEditorProperties>) {
  const client = useQueryClient();

  const capabilities = useCapabilities();

  const allowed =
    capabilities.data?.items.filter(
      (capability) => capability.status === CapabilityStatus.verified && capability.name !== DeviceProperty.cycle_mode,
    ) ?? [];

  const form = useForm<RuleInput>({
    resolver: zodResolver(ruleInputSchema),
    defaultValues: rule
      ? {
          name: rule.name,
          enabled: rule.enabled,
          priority: rule.priority,
          config: rule.config,
        }
      : {
          name: '',
          enabled: false,
          priority: ruleEditorSettings.defaultPriority,
          config:
            kind === RuleKind.automation
              ? { low: ruleEditorSettings.lowHumidity, high: ruleEditorSettings.highHumidity }
              : {
                  actions: [],
                  ...(kind === RuleKind.schedule && { days: allWeekdays, time: ruleEditorSettings.scheduleTime }),
                },
        },
  });

  const mutation = useMutation({
    mutationFn: (body: RuleInput) =>
      rule
        ? endpoints[kind].update({ path: { id: rule.id }, body }).unwrap()
        : endpoints[kind].create({ body }).unwrap(),
    onSuccess: async () => {
      await client.invalidateQueries();
      close();
    },
  });

  const isEnabled = useWatch({ control: form.control, name: 'enabled' });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {rule ? 'Редактировать' : 'Добавить'} · {titles[kind]}
        </CardTitle>
        <CardDescription>Доступны только проверенные настройки. Новое правило создаётся выключенным.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void form.handleSubmit((body) => mutation.mutate(body))(event);
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="rule-name">Название</FieldLabel>
              <Input id="rule-name" {...form.register('name')} aria-invalid={!!form.formState.errors.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-priority">Приоритет (большее число важнее)</FieldLabel>
              <Input
                id="rule-priority"
                type="number"
                min={ruleEditorSettings.minimumPriority}
                max={ruleEditorSettings.maximumPriority}
                {...form.register('priority', { valueAsNumber: true })}
              />
            </Field>
            {kind === RuleKind.automation ? (
              <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
                <Field>
                  <FieldLabel htmlFor="rule-low">Включить ниже, %</FieldLabel>
                  <Input
                    id="rule-low"
                    type="number"
                    min={ruleEditorSettings.minimumHumidity}
                    max={ruleEditorSettings.maximumLowHumidity}
                    {...form.register('config.low', { valueAsNumber: true })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="rule-high">Выключить выше, %</FieldLabel>
                  <Input
                    id="rule-high"
                    type="number"
                    min={ruleEditorSettings.minimumHighHumidity}
                    max={ruleEditorSettings.maximumHumidity}
                    {...form.register('config.high', { valueAsNumber: true })}
                  />
                </Field>
              </div>
            ) : (
              <RuleActions form={form} allowed={allowed} />
            )}
            {kind === RuleKind.schedule && <ScheduleFields form={form} />}
            {rule && kind !== RuleKind.scene && (
              <Field>
                <FieldLabel>Состояние правила</FieldLabel>
                <BinaryControl
                  label="Состояние правила"
                  isOn={isEnabled}
                  disabled={mutation.isPending}
                  onChange={(isOn) => form.setValue('enabled', isOn)}
                />
              </Field>
            )}
            {Object.keys(form.formState.errors).length > 0 && (
              <p className="text-xs text-error">Проверьте название, значения и приоритет.</p>
            )}
            {mutation.error && <Failure error={mutation.error} />}
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                Сохранить
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                Отмена
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
