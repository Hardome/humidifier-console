import {
  booleanCommands,
  brightnessLabels,
  CleaningDisplay,
  DeviceProperty,
  modes,
  powerLevels,
} from '@entities/humidifier';
import { BinaryControl } from '@shared/ui/binary-control';
import { Input } from '@shared/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

import type { Action } from '@api/types';

interface ActionValueProperties {
  readonly action: Action;
  readonly label: string;
  readonly onChange: (value: Action['value']) => void;
}

export function ActionValue({ action, label, onChange }: ActionValueProperties) {
  if (booleanCommands.has(action.name)) {
    return <BinaryControl label={label} isOn={Boolean(action.value)} disabled={false} onChange={onChange} />;
  }

  if (action.name === DeviceProperty.clean_end_display) {
    return (
      <BinaryControl
        label={label}
        isOn={action.value === CleaningDisplay.Visible}
        disabled={false}
        onChange={(isOn) => onChange(isOn ? CleaningDisplay.Visible : CleaningDisplay.Hidden)}
      />
    );
  }

  const choices: Partial<Record<Action['name'], Record<string, string>>> = {
    [DeviceProperty.mode]: modes,
    [DeviceProperty.brightness]: brightnessLabels,
    [DeviceProperty.level]: Object.fromEntries(powerLevels.map((level) => [level, String(level)])),
  };
  const options = choices[action.name];

  if (options) {
    return (
      <ToggleGroup
        aria-label={label}
        value={[String(action.value)]}
        variant="outline"
        spacing={0}
        className="w-full [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:flex-1"
        onValueChange={(values) => {
          if (values.length > 0) {
            onChange(Number(values[0]));
          }
        }}
      >
        {Object.entries(options).map(([value, title]) => (
          <ToggleGroupItem key={value} value={value} className="px-1 text-xs break-words whitespace-normal">
            {title}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <Input
      aria-label={label}
      type="number"
      value={Number(action.value)}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
