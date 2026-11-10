import { useGetCapabilities } from '@api/hooks/useGetCapabilities';
import { useGetSettings } from '@api/hooks/useGetSettings';
import { useGetState } from '@api/hooks/useGetState';

import { deviceQuerySettings } from './history-settings';

export const useDevice = () => useGetState({ query: { refetchInterval: deviceQuerySettings.deviceRefreshMs } });

export const useCapabilities = () =>
  useGetCapabilities({ query: { staleTime: deviceQuerySettings.capabilitiesStaleMs } });

export const useSettings = () => useGetSettings({ query: { refetchInterval: deviceQuerySettings.settingsRefreshMs } });
