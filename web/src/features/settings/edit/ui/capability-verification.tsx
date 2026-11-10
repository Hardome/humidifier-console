import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { booleanCommands, DeviceProperty, labels, useCapabilities, useDevice, useSettings } from '@entities/humidifier';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Failure } from '@shared/ui/feedback';
import { Field, FieldGroup, FieldLabel } from '@shared/ui/field';
import { Input } from '@shared/ui/input';
import { NativeSelect } from '@shared/ui/native-select';

import { restoreVerification, verifyCapability } from '@api/clients';
import type { Verification } from '@api/types';

import { initialVerificationValue, verificationMessage, verificationValue } from '../lib/verification';
import { CapabilitiesTable } from './capabilities-table';

export function CapabilityVerification() {
  const device = useDevice(),
    settings = useSettings(),
    capabilities = useCapabilities();

  const [name, setName] = useState<Verification['name']>(DeviceProperty.target_humidity);

  const [value, setValue] = useState(() => initialVerificationValue(DeviceProperty.target_humidity));

  const [observed, setObserved] = useState(false);

  const client = useQueryClient();

  const verify = useMutation({
    mutationFn: (body: Verification) => verifyCapability({ body }).unwrap(),
    onSuccess: () => client.invalidateQueries(),
  });

  const restore = useMutation({
    mutationFn: () => restoreVerification({ body: { observed } }).unwrap(),
    onSuccess: () => client.invalidateQueries(),
  });

  const isBool = booleanCommands.has(name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Проверка возможностей</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-[22px]">
          <Alert>
            <AlertTitle>Наблюдайте за прибором</AlertTitle>
            <AlertDescription>
              Для питания, режима и очистки требуется наблюдение владельца. Проверяйте фактическое поведение, прежде чем
              использовать функцию в автоматизации.
            </AlertDescription>
          </Alert>
          {settings.data?.restoration_pending && (
            <Alert variant="destructive">
              <AlertTitle>Требуется восстановление исходного значения</AlertTitle>
              <AlertDescription>
                Предыдущая проверка прервана. Фоновые команды заблокированы до восстановления.
                <Button variant="outline" disabled={!observed || restore.isPending} onClick={() => restore.mutate()}>
                  Восстановить при наблюдении
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {restore.error && <Failure error={restore.error} />}
          {capabilities.error && <Failure error={capabilities.error} />}
          <CapabilitiesTable />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              verify.mutate({
                name,
                value: verificationValue(name, value, isBool),
                observed,
              });
            }}
          >
            <FieldGroup>
              <div className="grid grid-cols-2 gap-[18px] max-[700px]:grid-cols-1">
                <Field>
                  <FieldLabel htmlFor="verify-name">Функция для проверки</FieldLabel>
                  <NativeSelect
                    id="verify-name"
                    value={name}
                    onChange={(event) => {
                      const next = event.target.value as typeof name;
                      setName(next);
                      setValue(initialVerificationValue(next));
                    }}
                  >
                    {capabilities.data?.items.map((capability) => (
                      <option key={capability.name} value={capability.name}>
                        {labels[capability.name]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="verify-value">Пробное значение</FieldLabel>
                  {isBool ? (
                    <NativeSelect id="verify-value" value={value} onChange={(event) => setValue(event.target.value)}>
                      <option value="true">Включить</option>
                      <option value="false">Выключить</option>
                    </NativeSelect>
                  ) : (
                    <Input
                      id="verify-value"
                      type="number"
                      value={value}
                      disabled={name === DeviceProperty.cycle_mode}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="verify-observed">Я наблюдаю за прибором и могу оценить поведение</FieldLabel>
                <input
                  id="verify-observed"
                  type="checkbox"
                  className="cursor-pointer disabled:cursor-default"
                  checked={observed}
                  onChange={(event) => setObserved(event.target.checked)}
                />
              </Field>
              <Button
                type="submit"
                disabled={verify.isPending || device.data?.stale || !observed || settings.data?.restoration_pending}
              >
                {verify.isPending ? 'Проверка и восстановление…' : 'Проверить и восстановить'}
              </Button>
              {verify.error && <Failure error={verify.error} />}
              <p aria-live="polite" className="text-[11px] leading-[1.6] text-hint">
                {verificationMessage(verify.isSuccess, verify.data?.verified)}
              </p>
            </FieldGroup>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
