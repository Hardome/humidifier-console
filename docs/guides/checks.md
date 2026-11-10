# Проверки и Git-хуки

Команды выполняются из корня, Node.js 24+, pnpm 11+, Python 3.12 и uv.

- `corepack pnpm bootstrap` устанавливает зависимости и Lefthook.
- `corepack pnpm --dir web lint` проверяет Biome, ESLint, CSS, FSD и орфографию.
- `corepack pnpm --dir web lint:fix` явно применяет исправления.
- `corepack pnpm --dir web check` проверяет линты, типы, тесты и сборку.
- `corepack pnpm check` запускает также контрактные и Python-проверки.
- `corepack pnpm test:e2e` запускает Playwright с изолированным тестовым API.
  Включает axe-проверки пяти экранов в обеих темах на desktop и mobile;
  ручная проверка клавиатуры и визуального поведения остаётся отдельной.

CI и check не исправляют исходники. Biome владеет форматированием и общими
правилами, ESLint дополняет TypeScript/React/Query-проверки; пересечения
зафиксированы в eslint-biome-overlaps.ts. Stylelint проверяет CSS,
Steiger — границы FSD, cspell — текст с русским словарём.

Lefthook — единственный установленный обработчик Git-хуков. Перед коммитом
он вызывает Python/file-проверки через pre-commit в manual-режиме,
lint-staged для фронта и Steiger. Перед push проверяет контракты, типы и
тесты фронта. Не устанавливайте отдельно `pre-commit install`.
Для существующей установки один раз выполните `uv run pre-commit uninstall`,
затем `corepack pnpm exec lefthook install`. Автоматически post-merge не
устанавливает зависимости: после получения изменений запускайте bootstrap.
