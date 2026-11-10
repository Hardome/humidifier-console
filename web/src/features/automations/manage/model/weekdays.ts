export const Weekday = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
} as const;

export type Weekday = (typeof Weekday)[keyof typeof Weekday];

export const weekdayOptions = [
  { value: Weekday.Monday, label: 'Пн' },
  { value: Weekday.Tuesday, label: 'Вт' },
  { value: Weekday.Wednesday, label: 'Ср' },
  { value: Weekday.Thursday, label: 'Чт' },
  { value: Weekday.Friday, label: 'Пт' },
  { value: Weekday.Saturday, label: 'Сб' },
  { value: Weekday.Sunday, label: 'Вс' },
] as const;

export const allWeekdays = weekdayOptions.map(({ value }) => value);
