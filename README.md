# Whisk Automation — Playwright JS

Automates [Google Labs Whisk](https://labs.google/fx/tools/whisk): navigates the site,
dismisses all post-login popups, and submits any prompt to the description field.

---

## Project Structure

```
whisk-automation/
├── auth/
│   ├── save-auth.js          # Run ONCE to save Google login session
│   └── whisk-auth.json       # Auto-generated — do NOT commit
├── pages/
│   ├── BasePage.js           # Popup dismissal + shared helpers
│   └── WhiskPage.js          # Whisk-specific POM
├── tests/
│   └── whisk.spec.js         # All test scenarios
├── .env.example              # Copy to .env
├── playwright.config.js
└── package.json
```

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chrome
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set WHISK_PROMPT if you want a custom prompt
```

### 3. Save your Google login session (run ONCE)

Whisk uses Google OAuth. Playwright cannot complete Google login automatically
(Google detects automation on its OAuth flow). You must log in manually once:

```bash
node auth/save-auth.js
```

This opens a real Chrome window. Sign into Google, reach the Whisk page,
close any popups yourself. The script detects when you're logged in and
saves the session to `auth/whisk-auth.json`.

> **Re-run this whenever your session expires** (typically every 7–14 days).

---

## Running Tests

```bash
# Run all tests (headless by default in CI, headed locally per config)
npm test

# Run headed so you can watch
npm run test:headed

# Debug a single test with Playwright Inspector
npm run test:debug

# Generate new selectors by recording interaction
npm run codegen
```

---

## Popup Dismissal Coverage

The `BasePage.dismissAllPopups()` method handles:

| Popup Type | Strategy |
|---|---|
| Cookie consent banners | Looks for "Accept all", "I agree", "Accept" buttons |
| Welcome / onboarding modals | Looks for "Got it", "Get started", "Continue", "Close" |
| Coach marks / feature tooltips | "Next", "Done", close icon buttons |
| Backdrop overlays | Clicks `.backdrop`, `.scrim`, `.overlay` elements |
| Generic catch-all | Presses `Escape` key |

If Whisk introduces a new popup type that isn't dismissed, add its selector to
the appropriate method in `BasePage.js`.

---

## Customizing the Prompt

**Via `.env`:**
```
WHISK_PROMPT=Your custom prompt here
```

**Via test directly:**
Edit `PROMPTS.default` in `tests/whisk.spec.js`.

---

## CI Integration (GitHub Actions)

```yaml
name: Whisk E2E
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install chrome
      - name: Restore auth state
        run: echo '${{ secrets.WHISK_AUTH_JSON }}' > auth/whisk-auth.json
      - run: npm test
        env:
          WHISK_PROMPT: ${{ secrets.WHISK_PROMPT }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

> Store the contents of `auth/whisk-auth.json` as a GitHub Secret named
> `WHISK_AUTH_JSON` for CI runs.
