import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['src/shared/context', 'src/shared/context/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
  {
    ignores: ['**/.gitkeep', 'src/assets/**', 'src/generated/**', 'src/app/routes/**', 'src/app/providers/**'],
  },
  {
    rules: {
      'fsd/insignificant-slice': 'off',
      'fsd/no-reserved-folder-names': 'off',
      'fsd/no-segmentless-slices': 'off',
    },
  },
]);
