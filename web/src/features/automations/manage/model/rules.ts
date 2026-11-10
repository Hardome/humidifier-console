import {
  createAutomation,
  createScene,
  createSchedule,
  deleteAutomation,
  deleteScene,
  deleteSchedule,
  updateAutomation,
  updateScene,
  updateSchedule,
} from '@api/clients';
import type { RuleItem } from '@api/types';

export type Kind = RuleItem['kind'];

export const endpoints = {
  scene: { create: createScene, update: updateScene, remove: deleteScene },
  schedule: {
    create: createSchedule,
    update: updateSchedule,
    remove: deleteSchedule,
  },
  automation: {
    create: createAutomation,
    update: updateAutomation,
    remove: deleteAutomation,
  },
};

export const titles = {
  scene: 'Сценарии',
  schedule: 'Расписания',
  automation: 'По влажности',
};
