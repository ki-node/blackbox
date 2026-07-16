import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/embedded",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174/fixtures/deep/orbit/projects/blackbox/",
    ...devices["iPhone 15"],
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "embedded-mobile-webkit", use: { browserName: "webkit" } },
    { name: "embedded-mobile-chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "node scripts/serve-embedded.mjs",
    url: "http://127.0.0.1:4174/fixtures/deep/orbit/projects/blackbox/",
    reuseExistingServer: !process.env.CI,
  },
});
