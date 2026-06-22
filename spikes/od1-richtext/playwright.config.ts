import { defineConfig } from '@playwright/test';

// Serve the built dist over http (file:// breaks module workers / srcdoc origin).
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  webServer: {
    command: 'bunx vite preview --outDir dist --port 4317 --strictPort',
    port: 4317,
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:4317' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
