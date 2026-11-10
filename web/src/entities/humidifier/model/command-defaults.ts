import type { CommandInput } from '@api/types/CommandInput';
import { commandInputNameEnum as DeviceProperty } from '@api/types/CommandInput';

import { CleaningDisplay, DisplayBrightness, HumidifierMode, PowerLevel, targetHumidity } from './device-values';

export const booleanCommands: ReadonlySet<string> = new Set([
  DeviceProperty.power,
  DeviceProperty.auto_dry,
  DeviceProperty.child_lock,
  DeviceProperty.sound,
  DeviceProperty.clean,
]);

const commandDefaults = {
  power: true,
  auto_dry: true,
  child_lock: true,
  sound: true,
  clean: true,
  mode: HumidifierMode.Auto,
  target_humidity: targetHumidity.default,
  brightness: DisplayBrightness.Off,
  level: PowerLevel.Level0,
  clean_end_display: CleaningDisplay.Hidden,
  cycle_mode: null,
} satisfies Record<CommandInput['name'], CommandInput['value']>;

export function defaultCommandValue(name: CommandInput['name']) {
  return commandDefaults[name];
}
