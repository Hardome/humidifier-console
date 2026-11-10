import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '@shared/lib/theme';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      aria-label="Тема оформления"
      className="w-full justify-center"
      value={[theme]}
      variant="outline"
      onValueChange={(values) => {
        const value = values[0];

        if (['light', 'dark', 'system'].includes(value)) {
          setTheme(value as import('@shared/lib/theme').Theme);
        }
      }}
    >
      <ToggleGroupItem value="system" aria-label="Системная" title="Системная">
        <Monitor aria-hidden="true" />
      </ToggleGroupItem>
      <ToggleGroupItem value="light" aria-label="Светлая" title="Светлая">
        <Sun aria-hidden="true" />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Тёмная" title="Тёмная">
        <Moon aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
