import { DeviceProperty, defaultCommandValue } from '@entities/humidifier';

import type { Verification } from '@api/types';

// Контракт Verification.value допускает число, boolean и null.

export function verificationValue(name: Verification['name'], value: string, isBool: boolean) {
  if (name === DeviceProperty.cycle_mode) {
    return null;
  }

  return isBool ? value === 'true' : Number(value);
}

export function initialVerificationValue(name: Verification['name']) {
  const value = defaultCommandValue(name);

  return value === null ? '' : String(value);
}

export function verificationMessage(isSuccess: boolean, isVerified?: boolean) {
  if (!isSuccess) {
    return 'Выберите значение, отличающееся от текущего.';
  }

  return isVerified
    ? 'Значение подтверждено, исходная настройка восстановлена.'
    : 'Проверка не пройдена. Исходная настройка восстановлена.';
}
