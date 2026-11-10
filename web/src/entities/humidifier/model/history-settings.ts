export const historySettings = {
  pageSize: 500,
  maximumRangeDays: 366,
  gapThresholdMs: 90_000,
  gapMarkerOffsetMs: 60_000,
  overviewRefreshMs: 60_000,
  overviewPeriodMs: 86_400_000,
} as const;

export const deviceQuerySettings = {
  deviceRefreshMs: 5_000,
  settingsRefreshMs: 10_000,
  capabilitiesStaleMs: 30_000,
  commandRefreshMs: 1_000,
} as const;
