import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

interface BinaryControlProperties {
  readonly label: string;
  readonly isOn?: boolean;
  readonly disabled: boolean;
  readonly onChange: (isOn: boolean) => void;
}

export function BinaryControl({ label, isOn, disabled, onChange }: BinaryControlProperties) {
  return (
    <ToggleGroup
      aria-label={label}
      value={isOn === undefined ? [] : [String(isOn)]}
      disabled={disabled}
      variant="outline"
      spacing={0}
      className="w-full [&>button]:min-h-11 [&>button]:flex-1"
      onValueChange={(values) => {
        if (values.length > 0) {
          onChange(values[0] === 'true');
        }
      }}
    >
      <ToggleGroupItem value="true">Включено</ToggleGroupItem>
      <ToggleGroupItem value="false">Выключено</ToggleGroupItem>
    </ToggleGroup>
  );
}
