import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray, useWatch } from 'react-hook-form';

import { defaultCommandValue, labels } from '@entities/humidifier';
import { Button } from '@shared/ui/button';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@shared/ui/field';
import { NativeSelect } from '@shared/ui/native-select';

import type { Action, Capability, RuleInput } from '@api/types';

import { ruleEditorSettings } from '../model/editor-settings';
import { ActionValue } from './action-value';

interface RuleActionsProperties {
  form: UseFormReturn<RuleInput>;
  allowed: Capability[];
}

export function RuleActions({ form, allowed }: Readonly<RuleActionsProperties>) {
  const actions = useWatch({ control: form.control, name: 'config.actions' }) ?? [];
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'config.actions' });

  const setAction = (index: number, action: Action) => form.setValue(`config.actions.${index}`, action);

  return (
    <FieldSet>
      <FieldLegend>Действия</FieldLegend>
      {actions.map((existingAction, index) => (
        <Field key={fields[index].id}>
          <FieldLabel>Действие {index + 1}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              aria-label={`Настройка ${index + 1}`}
              className="flex-1"
              value={existingAction.name}
              onChange={(event) =>
                setAction(index, {
                  name: event.target.value as Action['name'],
                  value: defaultCommandValue(event.target.value as Action['name']),
                })
              }
            >
              {allowed
                .filter(
                  (capability) =>
                    capability.name === existingAction.name ||
                    actions.every((configuredAction) => configuredAction.name !== capability.name),
                )
                .map((capability) => (
                  <option key={capability.name} value={capability.name}>
                    {labels[capability.name]}
                  </option>
                ))}
            </NativeSelect>
            <ActionValue
              action={existingAction}
              label={`Значение ${index + 1}`}
              onChange={(value) => setAction(index, { ...existingAction, value })}
            />
            <Button type="button" variant="ghost" onClick={() => remove(index)}>
              Убрать
            </Button>
          </div>
        </Field>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={allowed.length === 0 || actions.length >= ruleEditorSettings.maximumActions}
        onClick={() => {
          const availableCapability = allowed.find((candidateCapability) =>
            actions.every((configuredAction) => configuredAction.name !== candidateCapability.name),
          );

          if (availableCapability) {
            append({
              name: availableCapability.name,
              value: defaultCommandValue(availableCapability.name),
            });
          }
        }}
      >
        Добавить действие
      </Button>
    </FieldSet>
  );
}
