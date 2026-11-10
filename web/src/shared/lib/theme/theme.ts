import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const storageKey = 'humidifier-theme';

const eventName = 'humidifier-theme-change';

const state: { preference: Theme } = { preference: 'system' };

function readPreference(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);

    return stored === 'dark' || stored === 'light' ? stored : 'system';
  } catch {
    return state.preference;
  }
}

export function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  state.preference = theme;

  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // При запрете хранилища выбор действует до закрытия вкладки.
  }

  applyTheme(theme);
  window.dispatchEvent(new Event(eventName));
}

function subscribe(callback: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)');

  const update = () => {
    applyTheme(readPreference());
    callback();
  };

  media.addEventListener('change', update);
  window.addEventListener('storage', update);
  window.addEventListener(eventName, update);

  return () => {
    media.removeEventListener('change', update);
    window.removeEventListener('storage', update);
    window.removeEventListener(eventName, update);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readPreference, () => 'system' as const);

  const isResolved = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'));

  return { theme, resolved: isResolved, setTheme };
}
