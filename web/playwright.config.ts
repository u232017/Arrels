import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
// E2E_BUILD=1 tests the production build (vite build + preview) instead of the dev server.
const SERVER = process.env.E2E_BUILD
  ? `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`
  : `npx vite --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome", // installed Google Chrome; no browser download needed
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: SERVER,
    env: { VITE_DATA_DIR: "sample" }, // synthetic data only, never the NDA export
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false, // never reuse a dev server that may serve the real export
    timeout: 120_000,
  },
});
