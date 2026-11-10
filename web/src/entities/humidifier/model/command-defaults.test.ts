import { describe, expect, it } from 'vitest';

import { commandInputNameEnum } from '@api/types/CommandInput';
import { commandInputSchema } from '@api/zod/commandInputSchema';

import { defaultCommandValue } from './command-defaults';

describe('command defaults', () => {
  it.each(Object.values(commandInputNameEnum))('provides a valid payload for %s', (name) => {
    const value = defaultCommandValue(name);

    expect(value).not.toBeUndefined();
    expect(commandInputSchema.safeParse({ name, value }).success).toBe(true);
  });
});
