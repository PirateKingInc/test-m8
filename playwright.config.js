import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'node e2e/server.js', url: 'http://localhost:4173', reuseExistingServer: true },
});
