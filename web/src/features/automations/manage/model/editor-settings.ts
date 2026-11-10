export const ruleEditorSettings = {
  defaultPriority: 0,
  minimumPriority: -1_000,
  maximumPriority: 1_000,
  lowHumidity: 40,
  highHumidity: 55,
  minimumHumidity: 0,
  maximumHumidity: 100,
  minimumHighHumidity: 1,
  maximumLowHumidity: 99,
  maximumActions: 10,
  scheduleTime: '22:00',
} as const;

export const timerSettings = {
  defaultMinutes: 60,
  minimumMinutes: 1,
  maximumMinutes: 10_080,
} as const;
