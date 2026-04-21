// @ts-check
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Playwright configuration for Google Whisk automation.
 * Auth state is persisted via storageState so login runs ONCE.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,           // Whisk can be slow — AI generation takes time
  expect: { timeout: 15_000 },
  fullyParallel: false,       // Single user session; don't collide
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: "https://labs.google/fx/tools/whisk",
    headless: false,           // Whisk needs a real browser for Google OAuth
    viewport: { width: 1440, height: 900 },
    storageState: "./auth/whisk-auth.json",   // reuse saved login
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    // Realistic browser fingerprint — Google flags automation user-agents
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",     // use installed Chrome, not bundled Chromium
      },
    },
  ],
});
