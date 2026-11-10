// Коды из локальной спецификации zhimi.humidifier.ca7; значения передаются в API без преобразования.
export const HumidifierMode = {
  Sleep: 2,
  Auto: 3,
  Favorite: 4,
} as const;

export type HumidifierMode = (typeof HumidifierMode)[keyof typeof HumidifierMode];

export const HumidifierStatus = {
  Off: 1,
  Humidifying: 2,
  Drying: 3,
  Cleaning: 4,
} as const;

export type HumidifierStatus = (typeof HumidifierStatus)[keyof typeof HumidifierStatus];

export const DisplayBrightness = {
  Off: 0,
  Dim: 1,
  Normal: 2,
} as const;

export type DisplayBrightness = (typeof DisplayBrightness)[keyof typeof DisplayBrightness];

export const PowerLevel = {
  Level0: 0,
  Level1: 1,
  Level2: 2,
  Level3: 3,
  Level4: 4,
  Level5: 5,
} as const;

export type PowerLevel = (typeof PowerLevel)[keyof typeof PowerLevel];

export const CleaningDisplay = {
  Hidden: 0,
  Visible: 1,
} as const;

export type CleaningDisplay = (typeof CleaningDisplay)[keyof typeof CleaningDisplay];

export const DeviceFault = {
  None: 0,
} as const;

export type DeviceFault = (typeof DeviceFault)[keyof typeof DeviceFault];

export const DeviceRegion = {
  Europe: 44,
  Japan: 81,
  Korea: 82,
  China: 86,
  Taiwan: 886,
} as const;

export type DeviceRegion = (typeof DeviceRegion)[keyof typeof DeviceRegion];

// Смысл кодов воды подтверждается владельцем; заранее не называем их «низкий» и «нормальный».
export const WaterCode = {
  Unmapped0: '0',
  Unmapped1: '1',
  Unmapped2: '2',
} as const;

export type WaterCode = (typeof WaterCode)[keyof typeof WaterCode];

export const powerLevels = [
  PowerLevel.Level0,
  PowerLevel.Level1,
  PowerLevel.Level2,
  PowerLevel.Level3,
  PowerLevel.Level4,
  PowerLevel.Level5,
] as const;

export const waterCodes = Object.values(WaterCode);

export const targetHumidity = { minimum: 30, maximum: 60, default: 50, step: 1 } as const;
