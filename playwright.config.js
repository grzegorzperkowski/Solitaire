import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [{
    command: 'npm run preview -- --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  }, {
    command: 'npm run dev -- --port 5186 --strictPort',
    port: 5186,
    reuseExistingServer: !process.env.CI,
  }],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
