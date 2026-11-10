import js from '@eslint/js';
import eslintTanstack from '@tanstack/eslint-plugin-query';
import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { biomeOwnedEslintRules } from './eslint-biome-overlaps.ts';

// SonarJS публикует общий тип для legacy и flat-конфигураций; здесь используется flat.
const sonarRecommended = sonarjs.configs?.recommended as Linter.Config;

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', 'src/generated/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      ...eslintTanstack.configs['flat/recommended'],
      eslintUnicorn.configs.recommended,
      sonarRecommended,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...biomeOwnedEslintRules,
      'max-len': [
        'error',
        { code: 120, tabWidth: 2, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true },
      ],
      curly: ['error', 'all'],
      'id-length': ['error', { min: 2, properties: 'never' }],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': false }],
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-skipped-tests': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-null': 'off',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/**/*-test-setup.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      // Vitest требует вызовов vi.mock на верхнем уровне модуля.
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
);
