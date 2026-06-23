import { defineConfig } from "@playwright/test";

// Cross-browser harness. WebKit is mandatory — most iframe/srcdoc, pointer, and
// contenteditable quirks live there (PRD §9, R-1/R-2).
//
// Served over HTTP (never file://) by the Vite DEV server so bare `lit` imports
// and module loading resolve, and srcdoc iframes get a real same-origin. The dev
// server (not `preview`) is used because the library build externalizes Lit;
// dev-serving the source lets the browser resolve it from node_modules.
const PORT = 4318;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: `bunx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
