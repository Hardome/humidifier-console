import { describe, expect, it } from 'vitest';

import { eventsSearchSchema, getEventsQuery } from './search';

describe('events search', () => {
  it('normalizes missing and invalid URL values before requests', () => {
    expect(eventsSearchSchema.parse({ offset: -1, start: 'invalid' })).toEqual({
      offset: 0,
      start: '',
      end: '',
      type: '',
      source: '',
    });
  });
  it('keeps the offset and converts the date in one place', () => {
    const search = eventsSearchSchema.parse({ offset: 50, source: 'panel', start: '2026-11-08T00:00:00Z' });

    expect(getEventsQuery(search)).toMatchObject({ offset: 50, source: 'panel', start: '2026-11-08T00:00:00.000Z' });
  });
});
