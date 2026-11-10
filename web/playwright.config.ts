import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');

const python = JSON.stringify(
  resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'),
);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:5178', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: `${python} -m scripts.e2e_api`,
      cwd: root,
      url: 'http://127.0.0.1:8011/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'corepack pnpm exec vite --host 127.0.0.1 --port 5178 --strictPort --configLoader native',
      url: 'http://127.0.0.1:5178',
      reuseExistingServer: false,
      env: { E2E_API_URL: 'http://127.0.0.1:8011' },
      timeout: 30000,
    },
  ],
});
