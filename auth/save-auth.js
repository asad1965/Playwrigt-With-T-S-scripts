/**
 * auth/save-auth.js
 *
 * RUN ONCE before tests: `node auth/save-auth.js`
 *
 * Opens a headed Chrome window so you can manually complete
 * Google OAuth (handles 2FA, CAPTCHA, etc. that automation can't).
 * Saves cookies + localStorage to auth/whisk-auth.json.
 * Tests then load this state and skip login entirely.
 *
 * Re-run when: session expires (usually 7–14 days for Google).
 */

import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "whisk-auth.json");

// Ensure auth directory exists
if (!existsSync(__dirname)) {
  mkdirSync(__dirname, { recursive: true });
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled", // hide CDP flag from Google
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  console.log("──────────────────────────────────────────────────────");
  console.log("  Opening Google Whisk — please sign in manually.");
  console.log("  The script waits until you reach the Whisk main page.");
  console.log("  Close popups/dialogs if any appear after login.");
  console.log("──────────────────────────────────────────────────────");

  await page.goto("https://labs.google/fx/tools/whisk", {
    waitUntil: "domcontentloaded",
  });

  // Wait until the user is logged in and lands on Whisk proper.
  // We detect this by waiting for the prompt/description textarea to appear,
  // OR the main canvas/editor area — whichever comes first.
  await page.waitForFunction(
    () => {
      // Adjust these selectors after inspecting the live page if needed
      const indicators = [
        document.querySelector('textarea[placeholder]'),
        document.querySelector('[class*="prompt"]'),
        document.querySelector('[aria-label*="description" i]'),
        document.querySelector('[class*="whisk"]'),
        document.querySelector('main'),
      ];
      return indicators.some(Boolean);
    },
    { timeout: 300_000 } // 5 minutes for manual login
  );

  console.log("✅ Login detected — saving auth state…");
  await context.storageState({ path: AUTH_FILE });
  console.log(`✅ Auth saved to: ${AUTH_FILE}`);
  console.log("   You can now run: npm test");

  await browser.close();
})();
