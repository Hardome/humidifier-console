import { useState } from 'react';

import { Minus, Plus } from 'lucide-react';

import { targetHumidity } from '@entities/humidifier';
import { Button } from '@shared/ui/button';
import { Field, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';

interface TargetHumidityControlProperties {
  readonly currentValue?: number;
  readonly disabled: boolean;
  readonly onSubmit: (value: number) => void;
}

export function TargetHumidityControl({ currentValue, disabled, onSubmit }: TargetHumidityControlProperties) {
  const [target, setTarget] = useState<number | null>(null);

  const draft = target ?? currentValue ?? targetHumidity.default;
  const isValid = Number.isSafeInteger(draft) && draft >= targetHumidity.minimum && draft <= targetHumidity.maximum;

  const apply = (next: number) => {
    if (
      !(!disabled && Number.isSafeInteger(next) && next >= targetHumidity.minimum && next <= targetHumidity.maximum)
    ) {
      return;
    }

    if (next !== currentValue) {
      onSubmit(next);
    }

    setTarget(null);
  };

  return (
    <Field>
      <FieldLabel htmlFor="target">
        Целевая влажность · {targetHumidity.minimum}–{targetHumidity.maximum}%
      </FieldLabel>
      <div className="flex gap-2">
        <Button
          variant="outline"
          aria-label="Уменьшить целевую влажность"
          disabled={disabled || !isValid || draft <= targetHumidity.minimum}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply(draft - targetHumidity.step)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          id="target"
          type="number"
          min={targetHumidity.minimum}
          max={targetHumidity.maximum}
          step={targetHumidity.step}
          disabled={disabled}
          value={draft}
          aria-invalid={!isValid}
          onChange={(event) => setTarget(Number(event.target.value))}
          onBlur={() => apply(draft)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }

            event.preventDefault();
            event.currentTarget.blur();
          }}
        />
        <Button
          variant="outline"
          aria-label="Увеличить целевую влажность"
          disabled={disabled || !isValid || draft >= targetHumidity.maximum}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply(draft + targetHumidity.step)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </Field>
  );
}
