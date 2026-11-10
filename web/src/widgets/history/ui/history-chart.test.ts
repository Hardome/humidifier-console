import { expect, it } from 'vitest';

import { HumidifierStatus, targetHumidity } from '@entities/humidifier';

import type { HistoryPoint } from '@api/types';

import { withGaps } from './history-chart';

it('inserts a null break instead of joining disconnected observations', () => {
  const historyPointFixture = {
    at: '2026-11-08T00:00:00Z',
    count: 6,
    humidity: 45,
    temperature: 23,
    humidity_min: 44,
    humidity_max: 46,
    temperature_min: 23,
    temperature_max: 23,
    target_humidity: targetHumidity.default,
    speed: 0,
    power_seconds: 0,
    status: HumidifierStatus.Off,
  } satisfies HistoryPoint;
  const points = withGaps([
    historyPointFixture,
    { ...historyPointFixture, at: '2026-11-08T00:01:00Z' },
    { ...historyPointFixture, at: '2026-11-08T00:05:00Z' },
  ]);

  expect(points).toHaveLength(4);
  expect(points[2]).toEqual({ at: '2026-11-08T00:02:00.000Z', gap: true });
});
