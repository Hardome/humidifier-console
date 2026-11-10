import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CapabilityStatus,
  CleaningDisplay,
  CommandSource,
  CommandStatus,
  DeviceFault,
  DeviceProperty,
  DeviceRegion,
  DisplayBrightness,
  HumidifierMode,
  HumidifierStatus,
  PowerLevel,
  targetHumidity,
  WaterCode,
} from '@entities/humidifier';
import { HttpStatus } from '@shared/lib/http-status';

import type { CommandResult, State } from '@api/types';
import { commandInputSchema } from '@api/zod/commandInputSchema';

import { Controls } from './controls';

const state: State = {
  online: true,
  stale: false,
  measured_at: '2026-11-08T00:00:00Z',
  device: { model: 'zhimi.humidifier.ca7', firmware: 'test', hardware: 'test' },
  database_ok: true,
  error: null,
  values: {
    power: false,
    mode: HumidifierMode.Auto,
    target_humidity: targetHumidity.default,
    fault: DeviceFault.None,
    water_code: Number(WaterCode.Unmapped1),
    auto_dry: true,
    status: HumidifierStatus.Off,
    humidity: 45,
    temperature: 23.5,
    brightness: DisplayBrightness.Dim,
    sound: false,
    child_lock: false,
    speed: 0,
    country_code: DeviceRegion.Europe,
    clean: false,
    clean_minutes: 30,
    level: PowerLevel.Level2,
    clean_end_display: CleaningDisplay.Hidden,
  },
};

const names = [
  DeviceProperty.power,
  DeviceProperty.mode,
  DeviceProperty.target_humidity,
  DeviceProperty.auto_dry,
  DeviceProperty.brightness,
  DeviceProperty.sound,
  DeviceProperty.child_lock,
  DeviceProperty.clean,
  DeviceProperty.level,
  DeviceProperty.clean_end_display,
  DeviceProperty.cycle_mode,
];

const result: CommandResult = {
  id: 'test-command',
  at: '2026-11-08T00:00:00Z',
  name: DeviceProperty.power,
  value: { value: true },
  source: CommandSource.panel,
  status: CommandStatus.pending,
  error: null,
};

afterEach(() => vi.unstubAllGlobals());

function mount(status: CommandResult['status'], isVerified = true) {
  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  const writes: unknown[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = toRequest(input, init);
    const path = new URL(request.url).pathname;
    let body: unknown;

    if (path.endsWith('/capabilities')) {
      body = {
        items: capabilityItems(isVerified),
      };
    } else if (path.endsWith('/state')) {
      body = state;
    } else if (path.endsWith('/commands') && request.method === 'POST') {
      writes.push(await request.json());
      body = result;
    } else if (path.endsWith('/commands/test-command')) {
      await gate;

      body = {
        ...result,
        status,
        error: ({ failed: 'command_rejected', unknown: 'result_unknown' } as Record<string, string>)[status] ?? null,
      };
    } else {
      throw new Error(`Unexpected request ${path}`);
    }

    return Response.json(body, {
      status: path.endsWith('/commands') ? HttpStatus.Accepted : HttpStatus.Ok,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Controls />
    </QueryClientProvider>,
  );

  return { release, writes };
}

describe('device command confirmation', () => {
  it('shows all actions and the confirmed state of each switch', async () => {
    mount(CommandStatus.confirmed);

    await screen.findByText('Автоматический');

    expect(within(screen.getByRole('group', { name: 'Питание' })).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Яркость экрана' })).toBeVisible();
    await waitFor(() =>
      expect(
        within(screen.getByRole('group', { name: 'Автопросушка' })).getByRole('button', { name: 'Включено' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(
      within(screen.getByRole('group', { name: 'Звуки' })).getByRole('button', { name: 'Выключено' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(screen.getByRole('group', { name: 'Пользовательская мощность' })).getAllByRole('button'),
    ).toHaveLength(6);
  });
  it('applies humidity steps immediately without optimistic state', async () => {
    const { release, writes } = mount(CommandStatus.confirmed);
    const increase = screen.getByRole('button', { name: 'Увеличить целевую влажность' });

    await waitFor(() => expect(increase).toBeEnabled());
    fireEvent.click(increase);

    await screen.findByText('Ожидаем подтверждения…');

    expect(screen.getByRole('spinbutton')).toHaveValue(targetHumidity.default);
    expect(writes).toEqual([
      {
        name: DeviceProperty.target_humidity,
        value: targetHumidity.default + targetHumidity.step,
        source: CommandSource.panel,
      },
    ]);

    release();
    await screen.findByText('Прибор подтвердил изменение');
  });
  it('keeps controls disabled for unverified capabilities', async () => {
    mount(CommandStatus.confirmed, false);

    await screen.findByText('Автоматический');

    expect(
      within(screen.getByRole('group', { name: 'Питание' })).getByRole('button', { name: 'Включено' }),
    ).toBeDisabled();
  });
  it.each([
    [CommandStatus.confirmed, 'Прибор подтвердил изменение'],
    [CommandStatus.failed, 'Прибор отклонил команду.'],
    [CommandStatus.unknown, 'Ответ потерян. Результат неизвестен; команда не повторяется.'],
  ] as const)('renders %s after readback without optimistic state', async (status, message) => {
    const { release, writes } = mount(status);
    const power = within(screen.getByRole('group', { name: 'Питание' }));
    const button = power.getByRole('button', { name: 'Включено' });

    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText('Ожидаем подтверждения…');

    expect(power.getByRole('button', { name: 'Выключено' })).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toBeDisabled();

    release();
    await screen.findByText(message);

    expect(writes).toEqual([{ name: DeviceProperty.power, value: true, source: CommandSource.panel }]);
  });
  it('rejects unknown commands in the generated schema', () => {
    expect(commandInputSchema.safeParse({ name: 'send_packet', value: 1 }).success).toBe(false);
  });
});

function toRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return input;
  }

  const address = input.toString();

  return new Request(address.startsWith('/') ? `http://localhost${address}` : address, init);
}

function capabilityItems(isVerified: boolean) {
  return names.map((name) => ({
    name,
    status: isVerified ? CapabilityStatus.verified : CapabilityStatus.declared,
    requires_observation: false,
  }));
}
