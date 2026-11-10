import { useState } from 'react';

import { Button } from '@shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';

interface HistoryRangeFormProperties {
  readonly onSubmit: (range: { start: string; end: string }) => void;
}

export function HistoryRangeForm({ onSubmit }: Readonly<HistoryRangeFormProperties>) {
  const [range, setRange] = useState({ start: '', end: '' });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ start: new Date(range.start).toISOString(), end: new Date(range.end).toISOString() });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="range-start">Начало</FieldLabel>
          <Input
            id="range-start"
            type="datetime-local"
            required
            value={range.start}
            onChange={(event) => setRange({ ...range, start: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="range-end">Конец</FieldLabel>
          <Input
            id="range-end"
            type="datetime-local"
            required
            min={range.start}
            value={range.end}
            onChange={(event) => setRange({ ...range, end: event.target.value })}
          />
        </Field>
        <Button type="submit">Показать</Button>
      </FieldGroup>
    </form>
  );
}
