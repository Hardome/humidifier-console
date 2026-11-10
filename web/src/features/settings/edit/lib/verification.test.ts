import { describe, expect, it } from 'vitest';

import { DeviceProperty, DisplayBrightness } from '@entities/humidifier';

import { initialVerificationValue, verificationValue } from './verification';

describe('verification values', () => {
  it('keeps an explicit false value when verifying a boolean setting', () => {
    expect(verificationValue(DeviceProperty.power, 'false', true)).toBe(false);
  });

  it('keeps zero as a valid numeric setting', () => {
    expect(verificationValue(DeviceProperty.brightness, String(DisplayBrightness.Off), false)).toBe(
      DisplayBrightness.Off,
    );
  });

  it('sends no numeric argument when cycling modes', () => {
    expect(initialVerificationValue(DeviceProperty.cycle_mode)).toBe('');
    expect(verificationValue(DeviceProperty.cycle_mode, '', false)).toBeNull();
  });
});
