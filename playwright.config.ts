import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:4200', channel: 'chrome', headless: true, screenshot: 'only-on-failure', trace: 'off' },
  webServer: { command: 'npx.cmd ng serve --host localhost --port 4200', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 120000 },
});
