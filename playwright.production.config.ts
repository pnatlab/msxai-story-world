import { defineConfig, devices } from "@playwright/test";

/** Real built assets and public DOM; the production build has no inspection API. */
export default defineConfig({
  testDir: "./qa",
  testMatch: "mindhome.production.spec.ts",
  outputDir: "./test-results/production",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4185/msxai-story-world/",
    video: { mode: "on", size: { width: 1440, height: 900 } },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4185",
    url: "http://127.0.0.1:4185/msxai-story-world/",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [{ name: "chromium-production", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
