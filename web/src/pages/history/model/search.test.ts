import { describe, expect, it } from 'vitest';

import { historyRange, historySearchSchema, isHistoryRangeValid } from './search';

describe('history search', () => {
  it('normalizes invalid URL filters', () => {
    expect(historySearchSchema.parse({ period: 'invalid', metric: 'invalid', start: 'invalid' })).toEqual({
      period: 'day',
      metric: 'humidity',
      eventOffset: 0,
      start: undefined,
    });
  });
  it('keeps a stable default range and prevents reversed dates', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');

    expect(historyRange(historySearchSchema.parse({}), now)).toEqual({
      start: '2026-11-07T12:00:00.000Z',
      end: '2026-11-08T12:00:00.000Z',
    });

    const search = historySearchSchema.parse({ start: '2026-11-09T00:00:00Z', end: '2026-11-08T00:00:00Z' });

    expect(isHistoryRangeValid(historyRange(search, now))).toBe(false);
  });

  it.each([
    { start: '2026-11-08T00:00:00Z', end: '2026-11-08T00:00:00Z' },
    { start: '2024-01-01T00:00:00Z', end: '2026-11-08T00:00:00Z' },
  ])('rejects empty and oversized ranges before requests', (range) => {
    expect(isHistoryRangeValid(range)).toBe(false);
  });
});
