import { DisplayBrightness, HumidifierMode, HumidifierStatus } from './device-values';

export const modes: Record<number, string> = {
  [HumidifierMode.Sleep]: 'Ночной',
  [HumidifierMode.Auto]: 'Автоматический',
  [HumidifierMode.Favorite]: 'Пользовательский',
};

export const statuses: Record<number, string> = {
  [HumidifierStatus.Off]: 'Выключен',
  [HumidifierStatus.Humidifying]: 'Увлажняет',
  [HumidifierStatus.Drying]: 'Просушивается',
  [HumidifierStatus.Cleaning]: 'Очищается',
};

export const labels: Record<string, string> = {
  power: 'Питание',
  mode: 'Режим',
  target_humidity: 'Целевая влажность',
  auto_dry: 'Автопросушка',
  brightness: 'Яркость экрана',
  sound: 'Звуки',
  child_lock: 'Блокировка кнопок',
  clean: 'Очистка',
  level: 'Мощность',
  clean_end_display: 'Индикация завершения очистки',
  cycle_mode: 'Следующий режим',
};

export const brightnessLabels: Record<number, string> = {
  [DisplayBrightness.Off]: 'Выключен',
  [DisplayBrightness.Dim]: 'Тусклый',
  [DisplayBrightness.Normal]: 'Обычный',
};
