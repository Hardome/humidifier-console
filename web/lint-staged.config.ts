export default {
  '{src,tests}/**/*.{js,jsx,ts,tsx}': [
    'corepack pnpm exec biome check --write --no-errors-on-unmatched',
    'corepack pnpm exec eslint --flag unstable_native_nodejs_ts_config --fix --max-warnings=0 --no-warn-ignored',
    'corepack pnpm exec cspell --no-progress --config ../cspell.config.yaml',
  ],
  'src/**/*.css': [
    'corepack pnpm exec biome check --write --no-errors-on-unmatched',
    'corepack pnpm exec stylelint --fix',
  ],
};
