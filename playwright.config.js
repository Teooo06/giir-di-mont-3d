import { defineConfig, devices } from '@playwright/test';

/**
 * YOU-33 Visual regression — ponytail: minimal config, reuses vite dev server, 1280x720 viewport for stable baselines
 * - webServer reuses existing `npm run dev:web` if already running (local), starts fresh in CI
 * - toHaveScreenshot uses 100px diff tolerance for WebGL anti-alias jitter
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'visual.spec.js',
  timeout: 30000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 150,
      threshold: 0.2,
    },
  },
  fullyParallel: false,
  workers: 1, // WebGL needs serial — avoid GPU contention, keeps <60s anyway (~3s per state)
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5173 --host 127.0.0.1 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
    stdout: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-gl=swiftshader', '--disable-dev-shm-usage'] } },
    },
  ],
});
