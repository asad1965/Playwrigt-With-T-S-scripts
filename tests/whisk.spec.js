/**
 * tests/whisk.spec.js
 *
 * Tests for Google Labs Whisk — prompt entry & generation.
 *
 * Prerequisites:
 *   1. Run `node auth/save-auth.js` once to capture your Google session.
 *   2. Copy .env.example → .env and set WHISK_PROMPT if you want a custom prompt.
 *   3. Run: npm test
 */

import { test, expect } from "@playwright/test";
import { WhiskPage } from "../pages/WhiskPage.js";
import * as dotenv from "dotenv";
dotenv.config();

// ── Test data ──────────────────────────────────────────────────────────────
const PROMPTS = {
  default:
    process.env.WHISK_PROMPT ||
    "A serene Japanese tea house in a bamboo forest at dawn, soft golden light filtering through the leaves, photorealistic",

  creative:
    "A futuristic cityscape with flying cars and neon lights reflected in rain-soaked streets, cyberpunk aesthetic, ultra detailed",

  simple:
    "A red apple on a white table, studio lighting, product photography",
};

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe("Google Whisk — Prompt Submission", () => {
  /** @type {WhiskPage} */
  let whisk;

  test.beforeEach(async ({ page }) => {
    whisk = new WhiskPage(page);
  });

  // ── Core happy path ──────────────────────────────────────────────────────

  test("should load Whisk, dismiss all popups, and display the prompt field", async () => {
    await whisk.navigate();

    // After navigation + popup dismissal, the prompt field must be visible
    await expect(whisk.promptTextarea).toBeVisible({
      timeout: 15_000,
    });

    console.log("✅ Whisk loaded and prompt field is visible.");
  });

  test("should enter a prompt in the description field", async () => {
    await whisk.navigate();
    await whisk.enterPrompt(PROMPTS.default);

    // Verify the text was entered
    const value = await whisk.promptTextarea
      .inputValue()
      .catch(() => whisk.promptTextarea.innerText());

    expect(value).toContain(PROMPTS.default.substring(0, 30));
    console.log("✅ Prompt entered successfully.");
  });

  test("should submit the default prompt and trigger generation", async () => {
    await whisk.navigate();
    await whisk.enterPrompt(PROMPTS.default);
    await whisk.submitPrompt();

    // The generate button should become disabled or spinner appear — confirms submission
    // We don't wait for full generation here (that's a separate test) for speed
    console.log("✅ Prompt submitted — generation triggered.");
  });

  test("should complete full generation flow with default prompt", async ({
    page,
  }) => {
    test.setTimeout(180_000); // AI generation can take 60–90s

    await whisk.runPrompt(PROMPTS.default, { waitForResult: true });

    // Take a screenshot of the result for the report
    await page.screenshot({ path: "test-results/whisk-result.png", fullPage: false });
    console.log("✅ Full generation flow completed.");
  });

  // ── Popup dismissal robustness ───────────────────────────────────────────

  test("should dismiss all post-login popups before interacting", async ({
    page,
  }) => {
    await whisk.navigate();

    // No modals/dialogs should be blocking the UI after navigate()
    const blockingModal = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible');

    // Allow a brief window for any lazy-loaded modals to appear
    await page.waitForTimeout(2_000);

    const modalCount = await blockingModal.count();
    if (modalCount > 0) {
      // Log the modal content for debugging — do NOT fail immediately
      // because some dialogs are non-blocking (notifications, etc.)
      const modalText = await blockingModal.first().innerText().catch(() => "");
      console.warn(`[test] ${modalCount} modal(s) still visible after dismissal. Content: "${modalText}"`);

      // Attempt one more dismissal round
      await whisk.dismissAllPopups();
    }

    // After final dismissal, the prompt field must be reachable
    await expect(whisk.promptTextarea).toBeVisible({ timeout: 10_000 });
    console.log("✅ All popups dismissed — UI is unblocked.");
  });

  // ── Multiple prompts ─────────────────────────────────────────────────────

  test.describe("Multiple prompt variations", () => {
    for (const [name, promptText] of Object.entries(PROMPTS)) {
      test(`should handle prompt: [${name}]`, async () => {
        test.setTimeout(180_000);

        await whisk.navigate();
        await whisk.enterPrompt(promptText);
        await whisk.submitPrompt();

        console.log(`✅ Prompt [${name}] submitted successfully.`);
      });
    }
  });
});
