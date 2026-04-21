/**
 * pages/BasePage.js
 *
 * All shared helpers live here:
 *  - popup/modal/overlay dismissal
 *  - safe click (waits, scrolls into view)
 *  - smart wait for network quiet
 */

export class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.defaultTimeout = 10_000;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async goto(url = "") {
    await this.page.goto(url || "https://labs.google/fx/tools/whisk", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await this.dismissAllPopups();
  }

  // ─── Popup / Modal / Cookie / Overlay Dismissal ───────────────────────────

  /**
   * Central popup dismissal bus.
   * Runs all known dismissal strategies in parallel, catches misses silently.
   * Call after navigation and after any action that might spawn a modal.
   */
  async dismissAllPopups() {
    await this._dismissCookieConsent();
    await this._dismissWelcomeModal();
    await this._dismissGenericOverlays();
    await this._dismissTooltipCoachMarks();
  }

  async _dismissCookieConsent() {
    const cookieSelectors = [
      // Google consent variants
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      '[aria-label="Accept all"]',
      '[aria-label="Agree to the use of cookies"]',
      // Labs.google specific
      '[data-cookiebanner] button',
      '#cookieConsent button',
    ];

    for (const sel of cookieSelectors) {
      try {
        const btn = this.page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2_000 })) {
          await btn.click({ timeout: 3_000 });
          console.log(`[popup] Dismissed cookie consent: ${sel}`);
          await this.page.waitForTimeout(500);
          break;
        }
      } catch {
        // Not found — continue
      }
    }
  }

  async _dismissWelcomeModal() {
    const dismissSelectors = [
      // Common "get started" / "close" patterns
      'button:has-text("Got it")',
      'button:has-text("Get started")',
      'button:has-text("Start creating")',
      'button:has-text("Continue")',
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
      'button:has-text("Skip")',
      'button:has-text("Maybe later")',
      // Icon buttons — close / X
      '[aria-label="Close"]',
      '[aria-label="Dismiss"]',
      '[aria-label="close"]',
      '[data-testid="close-button"]',
      '[data-testid="dismiss-button"]',
      // Material / Google dialog close buttons
      'mat-dialog-container button[type="button"]:last-child',
      '.mdc-dialog__actions button:first-child',
      // Labs-specific overlay
      '[class*="modal"] button',
      '[class*="dialog"] button[class*="close"]',
      '[class*="overlay"] button[class*="close"]',
      // Role-based (most resilient)
      'dialog button[aria-label="Close"]',
    ];

    for (const sel of dismissSelectors) {
      try {
        const btn = this.page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1_500 })) {
          await btn.click({ timeout: 3_000 });
          console.log(`[popup] Dismissed welcome modal: ${sel}`);
          await this.page.waitForTimeout(600);
        }
      } catch {
        // Not found — continue
      }
    }
  }

  async _dismissGenericOverlays() {
    // Backdrop click — for modals that dismiss on outside click
    const overlaySelectors = [
      '[class*="backdrop"]:visible',
      '[class*="scrim"]:visible',
      '[class*="overlay"]:visible:not(iframe)',
    ];

    for (const sel of overlaySelectors) {
      try {
        const overlay = this.page.locator(sel).first();
        if (await overlay.isVisible({ timeout: 1_000 })) {
          await overlay.click({ force: true, timeout: 2_000 });
          console.log(`[popup] Dismissed backdrop overlay: ${sel}`);
          await this.page.waitForTimeout(400);
        }
      } catch {
        // Not blocking — continue
      }
    }

    // Escape key as final catch-all
    try {
      await this.page.keyboard.press("Escape");
    } catch {
      // No-op
    }
  }

  async _dismissTooltipCoachMarks() {
    // Google products often show onboarding coach marks / feature highlights
    const coachSelectors = [
      'button:has-text("Next")',
      'button:has-text("Done")',
      '[class*="coach"] button',
      '[class*="tooltip"] button[aria-label="Close"]',
      '[class*="snackbar"] button',
      '[role="tooltip"] button',
    ];

    for (const sel of coachSelectors) {
      try {
        const btn = this.page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1_000 })) {
          await btn.click({ timeout: 2_000 });
          console.log(`[popup] Dismissed coach mark: ${sel}`);
          await this.page.waitForTimeout(400);
        }
      } catch {
        // Not found
      }
    }
  }

  // ─── Utility Helpers ──────────────────────────────────────────────────────

  /**
   * Waits for the page to settle (no pending network for 500ms).
   */
  async waitForNetworkIdle(timeout = 10_000) {
    try {
      await this.page.waitForLoadState("networkidle", { timeout });
    } catch {
      // Timeout is acceptable — page may have long-polls
    }
  }

  /**
   * Safe click: scrolls into view, waits for enabled state, then clicks.
   * @param {import('@playwright/test').Locator} locator
   */
  async safeClick(locator) {
    await locator.waitFor({ state: "visible", timeout: this.defaultTimeout });
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
  }

  /**
   * Retry a callback N times with a delay between attempts.
   * @param {Function} fn
   * @param {number} retries
   * @param {number} delayMs
   */
  async retry(fn, retries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) throw err;
        console.warn(`[retry] Attempt ${attempt} failed: ${err.message}`);
        await this.page.waitForTimeout(delayMs);
      }
    }
  }
}
