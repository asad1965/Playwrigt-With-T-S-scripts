/**
 * pages/WhiskPage.js
 *
 * Page Object Model for labs.google/fx/tools/whisk
 *
 * Responsibilities:
 *  - Navigate to Whisk
 *  - Dismiss all post-login popups
 *  - Locate and fill the description/prompt textarea
 *  - Submit the prompt and wait for generation to start
 *  - Expose generation state (running / complete / error)
 */

import { expect } from "@playwright/test";
import { BasePage } from "./BasePage.js";

export class WhiskPage extends BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page);

    // ── Locator definitions ──────────────────────────────────────────────
    // Priority: aria-label > placeholder > role > CSS
    // Adjust these after inspecting the live DOM if Whisk updates its markup.

    // The main prompt / description text field
    this.promptTextarea = page
      .locator(
        [
          'textarea[aria-label*="description" i]',
          'textarea[placeholder*="description" i]',
          'textarea[aria-label*="prompt" i]',
          'textarea[placeholder*="prompt" i]',
          'textarea[aria-label*="describe" i]',
          '[contenteditable="true"][aria-label*="description" i]',
          '[contenteditable="true"][aria-label*="prompt" i]',
          // Whisk-specific fallbacks observed in the wild
          '[data-testid="prompt-input"]',
          '[class*="prompt"] textarea',
          '[class*="description"] textarea',
          // Final fallback — first textarea visible on page
          "textarea",
        ].join(",")
      )
      .first();

    // Submit / Generate button
    this.generateButton = page
      .locator(
        [
          'button[aria-label*="generate" i]',
          'button[aria-label*="create" i]',
          'button:has-text("Generate")',
          'button:has-text("Create")',
          'button:has-text("Whisk")',
          'button[type="submit"]',
          '[data-testid="generate-button"]',
        ].join(",")
      )
      .first();

    // Generation progress / spinner indicator
    this.loadingIndicator = page.locator(
      [
        '[aria-label*="loading" i]',
        '[aria-label*="generating" i]',
        '[class*="spinner"]',
        '[class*="loading"]',
        '[role="progressbar"]',
      ].join(",")
    );

    // Generated result container
    this.resultContainer = page.locator(
      [
        '[class*="result"]',
        '[class*="output"]',
        '[class*="generated"]',
        '[data-testid="result"]',
        'img[alt*="generated" i]',
        'img[alt*="result" i]',
      ].join(",")
    );

    // Error state
    this.errorMessage = page.locator(
      [
        '[class*="error"]',
        '[role="alert"]',
        '[aria-live="assertive"]',
      ].join(",")
    );
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  async navigate() {
    console.log("[whisk] Navigating to Whisk…");
    await this.page.goto("https://labs.google/fx/tools/whisk", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Give the app JS a moment to boot before looking for popups
    await this.page.waitForTimeout(2_000);

    // Dismiss ALL post-login popups in sequence
    await this.dismissAllPopups();

    // Ensure page is interactive
    await this.waitForPageReady();
    console.log("[whisk] Page ready.");
  }

  /**
   * Wait until the prompt field is visible and interactable.
   * This is our signal that Whisk has fully loaded.
   */
  async waitForPageReady() {
    await this.retry(async () => {
      await this.promptTextarea.waitFor({
        state: "visible",
        timeout: 20_000,
      });
    }, 3, 2_000);
  }

  // ─── Core Actions ─────────────────────────────────────────────────────────

  /**
   * Fill the description/prompt textarea with the given text.
   * Handles both <textarea> and contenteditable elements.
   *
   * @param {string} promptText - The prompt to enter
   */
  async enterPrompt(promptText) {
    console.log(`[whisk] Entering prompt: "${promptText}"`);

    await this.dismissAllPopups(); // clear any lingering popups before interaction

    const textarea = this.promptTextarea;
    await textarea.waitFor({ state: "visible", timeout: 15_000 });
    await textarea.scrollIntoViewIfNeeded();

    // Check if it's a contenteditable div vs a real textarea
    const tagName = await textarea.evaluate((el) => el.tagName.toLowerCase());
    const isContentEditable = await textarea.evaluate(
      (el) => el.isContentEditable
    );

    if (isContentEditable || tagName === "div") {
      // ContentEditable: click to focus, then type
      await textarea.click();
      await textarea.evaluate((el) => (el.textContent = ""));
      await textarea.pressSequentially(promptText, { delay: 30 });
    } else {
      // Standard textarea: fill() is atomic and reliable
      await textarea.click();
      await textarea.fill(promptText);
    }

    // Verify the text was entered
    const enteredText = await textarea.inputValue().catch(async () => {
      // contenteditable fallback
      return await textarea.innerText();
    });

    if (!enteredText.includes(promptText.substring(0, 20))) {
      throw new Error(
        `[whisk] Prompt entry verification failed. Got: "${enteredText}"`
      );
    }

    console.log("[whisk] Prompt entered successfully.");
  }

  /**
   * Click the Generate / Create button and wait for generation to begin.
   */
  async submitPrompt() {
    console.log("[whisk] Submitting prompt…");

    await this.generateButton.waitFor({ state: "visible", timeout: 10_000 });
    await this.generateButton.scrollIntoViewIfNeeded();

    // Check button isn't disabled
    const isDisabled = await this.generateButton.isDisabled();
    if (isDisabled) {
      throw new Error("[whisk] Generate button is disabled — prompt may be empty.");
    }

    await this.generateButton.click();
    console.log("[whisk] Generate clicked.");
  }

  /**
   * Wait for generation to complete (spinner gone + result visible).
   *
   * @param {number} timeoutMs - Max time to wait (default 120s — AI gen is slow)
   * @returns {Promise<void>}
   */
  async waitForGenerationComplete(timeoutMs = 120_000) {
    console.log("[whisk] Waiting for generation to complete…");

    // Step 1: Wait for spinner / loader to appear (confirms generation started)
    try {
      await this.loadingIndicator.waitFor({
        state: "visible",
        timeout: 8_000,
      });
      console.log("[whisk] Generation in progress…");
    } catch {
      // Spinner may flash too fast — that's fine, continue to result check
      console.log("[whisk] No spinner detected — checking for result directly.");
    }

    // Step 2: Wait for spinner to disappear (generation complete)
    try {
      await this.loadingIndicator.waitFor({
        state: "hidden",
        timeout: timeoutMs,
      });
    } catch {
      // No spinner or already gone — check for result/error
    }

    // Step 3: Verify result OR error
    const [resultVisible, errorVisible] = await Promise.all([
      this.resultContainer.isVisible().catch(() => false),
      this.errorMessage.isVisible().catch(() => false),
    ]);

    if (errorVisible) {
      const errorText = await this.errorMessage.innerText().catch(() => "unknown error");
      throw new Error(`[whisk] Generation failed with error: "${errorText}"`);
    }

    if (!resultVisible) {
      console.warn("[whisk] No result container found — page may have updated its DOM.");
    } else {
      console.log("[whisk] Generation complete — result visible.");
    }
  }

  // ─── Composite Workflow ───────────────────────────────────────────────────

  /**
   * Full end-to-end: navigate → dismiss popups → enter prompt → submit → wait.
   *
   * @param {string} promptText
   * @param {{ waitForResult?: boolean }} options
   */
  async runPrompt(promptText, { waitForResult = true } = {}) {
    await this.navigate();
    await this.enterPrompt(promptText);
    await this.submitPrompt();
    if (waitForResult) {
      await this.waitForGenerationComplete();
    }
  }
}
