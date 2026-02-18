# BackstopJS Visual Regression Testing

This document explains how to use BackstopJS for visual regression testing in this project.

## Overview

BackstopJS with Puppeteer is used for visual regression testing to ensure UI consistency across changes. The system maintains separate reference images for different environments and supports cross-environment testing.

## Configuration Files

- **`backstop.scenarios.json`** - Single source of truth for test scenarios
- **`backstop.base.json`** - Base configuration (viewports, engine settings, global selectors)
- **`scripts/backstop-config.js`** - Simple generator that combines scenarios with base config

## Scenario Properties

Each scenario in `backstop.scenarios.json` supports the following properties:

### Required Properties:
- `label`: (string) Descriptive name for the test scenario
- `urls`: (object) Contains `local` and `production` URL variants

### Optional Properties:
- `delay`: (number) Milliseconds to wait before screenshot (default: 1000)
- `selectors`: (array) CSS selectors to capture (default: ["document"])
- `misMatchThreshold`: (number) Tolerance for pixel differences (default: 0.1)
- `requireSameDimensions`: (boolean) Require exact same dimensions (default: true)

### Advanced Properties:
- `hideSelectors`: (array) CSS selectors to hide before screenshot
- `removeSelectors`: (array) CSS selectors to remove from DOM
- `clickSelector`: (string) CSS selector to click before screenshot
- `hoverSelector`: (string) CSS selector to hover before screenshot
- `scrollToSelector`: (string) CSS selector to scroll to before screenshot
- `requiresLogin`: (boolean) Whether this scenario needs authentication

### Feature Tags (Documentation Only)
The optional `features` array is for documentation purposes only. Common tags include:
- `animations` - Tests animated elements
- `navigation` - Tests navigation components
- `banner` - Tests banner/hero sections
- `mosaic-layout` - Tests Plone Mosaic layouts
- `pdf-download` - Tests download functionality
- `scroll-triggered` - Tests scroll-based interactions
- `authenticated` - Tests pages requiring login
- `showcase` - Scenarios suitable for stakeholder presentations (used by showcase mode)

## Authentication Setup

For scenarios requiring login, authentication is handled in the engine scripts (`backstop_data/engine_scripts/puppet/`):

### Cookie-based Authentication (Current Setup)
1. Login to your site manually in a browser
2. Extract the `__ac` cookie value from browser dev tools
3. Update `backstop_data/engine_scripts/cookies.json` with the cookie value
4. Use `requiresLogin: true` property in scenarios that need authentication

### Plone Authentication Cookies
Plone uses these cookies for authentication:
- **`__ac`** - Main authentication cookie (required)
- **`__ac_name`** - Username cookie (optional)

### Form-based Login (Alternative)
Modify `backstop_data/engine_scripts/puppet/onBefore.js` to include login automation:
```javascript
if (scenario.requiresLogin) {
  await page.goto('http://localhost:8080/oag/login');
  await page.type('#__ac_name', 'admin');
  await page.type('#__ac_password', 'admin');
  await page.click('input[type="submit"]');
  await page.waitForNavigation();
}
```

## Reference Management System

The system maintains separate reference images for different environments:

- **Local References** (`backstop_data/bitmaps_reference_local/`) - Screenshots from local development
- **Production References** (`backstop_data/bitmaps_reference_production/`) - Screenshots from production

## Testing Scenarios

### 1. Development Testing
`pnpm backstop:test` - Compare local development against local references
- **Use case**: Normal development workflow
- **URLs**: Local development
- **References**: Local reference images

### 2. Production Validation
`pnpm backstop:test:prod` - Compare production against production references
- **Use case**: Validate production deployment
- **URLs**: Production
- **References**: Production reference images

### 3. Regression Testing
`pnpm backstop:test:cross` - Compare local development against production references
- **Use case**: Check if local changes break production look
- **URLs**: Local development
- **References**: Production reference images

### 4. Deployment Validation
`pnpm backstop:test:prod-cross` - Compare production against local references
- **Use case**: Check if production matches expected local state
- **URLs**: Production
- **References**: Local reference images

## Stakeholder Showcase Mode

For stakeholder presentations and demos, a specialized showcase mode is available that:
- Uses only 2 viewports (xs and xl) for faster execution
- Only includes scenarios tagged with "showcase" feature
- Generates reports in separate location to avoid conflicts with regression testing
- Uses separate reference images to avoid filename conflicts (scenario indices differ)

### Showcase Testing Scenarios

#### 1. Showcase Development
`pnpm showcase:test` - Compare local development against local references (showcase scenarios only)
- **Use case**: Quick stakeholder preview of local changes
- **URLs**: Local development
- **References**: Local reference images
- **Viewports**: xs (360x640) and xl (1440x900) only

#### 2. Showcase Production
`pnpm showcase:test:prod` - Compare production against production references (showcase scenarios only)
- **Use case**: Stakeholder demo of production state
- **URLs**: Production
- **References**: Production reference images

#### 3. Showcase Cross-Environment
`pnpm showcase:test:cross` - Compare local development against production references (showcase scenarios only)
- **Use case**: Show stakeholders how local changes differ from production
- **URLs**: Local development
- **References**: Production reference images

#### 4. Showcase Deployment Check
`pnpm showcase:test:prod-cross` - Compare production against local references (showcase scenarios only)
- **Use case**: Validate production deployment matches expected state for stakeholders
- **URLs**: Production
- **References**: Local reference images

### Showcase Commands

#### Reference Generation:
- `pnpm showcase:reference` - Generate showcase reference images (local)
- `pnpm showcase:reference:prod` - Generate showcase reference images (production)

#### Testing (Raw Results):
- `pnpm showcase:test` - Local vs Local references (showcase only)
- `pnpm showcase:test:prod` - Production vs Production references (showcase only)
- `pnpm showcase:test:cross` - Local vs Production references (showcase only)
- `pnpm showcase:test:prod-cross` - Production vs Local references (showcase only)

#### Testing + Processing (Git-Ready Results):
- `pnpm showcase:test:process` - Test local and copy results to git-tracked location
- `pnpm showcase:test:prod:process` - Test production and copy results to git-tracked location
- `pnpm showcase:test:cross:process` - Cross-test and copy results to git-tracked location
- `pnpm showcase:test:prod-cross:process` - Cross-test production and copy results to git-tracked location

#### Processing:
- `pnpm showcase:process` - Copy latest test results to git-tracked location

#### Reports:
- `pnpm showcase:report` - Open processed showcase HTML report (git-tracked version)

### Adding Scenarios to Showcase Mode
To include a scenario in showcase mode, add "showcase" to its features array:
```json
{
  "label": "Homepage",
  "urls": {
    "local": "http://localhost:8080/oag",
    "production": "https://devoag.pidwell.com/"
  },
  "features": ["navigation", "banner", "showcase"],
  "delay": 1000,
  "selectors": ["document"]
}
```

**Benefits of Showcase Mode:**
- **Faster execution**: 2 viewports × showcase scenarios vs 6 viewports × all scenarios
- **Stakeholder-focused**: Only key pages relevant for demos
- **Isolated workflow**: Separate reference images, test results, and reports
- **No interference**: Won't affect development regression testing
- **Professional presentation**: Clean, focused test results for stakeholders

**Showcase Directory Structure:**
```
backstop_data/
├── showcase_bitmaps_reference_local/     # Git tracked - Local reference images
├── showcase_bitmaps_reference_production/ # Git tracked - Production reference images
├── showcase_current/                     # Git tracked - Processed results
│   ├── test_images/                     # Latest test screenshots
│   └── html_report/                     # Latest HTML report
├── showcase_bitmaps_test/                # Local only - Timestamped test results
├── showcase_html_report/                 # Local only - Raw HTML reports
└── showcase_json_report/                 # Local only - JSON reports (excluded)
```

**Workflow for Stakeholder Presentations:**
1. **Run tests with processing**: `pnpm showcase:test:process`
2. **View results**: `pnpm showcase:report` (opens git-tracked version)
3. **Commit for stakeholders**: Results in `showcase_current/` are ready for git

**Reference Image Separation:**
Separate reference images are necessary because filtered scenarios have different indices, causing filename conflicts with standard reference images.

## Quick Testing Mode (Single Viewport)

The quick testing mode provides fast visual regression testing using only the **lg viewport** (1280x800px). This reduces test execution time by approximately **6x** compared to standard 6-viewport testing, making it ideal for rapid development iterations.

### When to Use Quick Mode

**✅ Use Quick Mode For:**
- Rapid development iterations
- Component-level testing
- Quick validation of changes
- Pre-commit checks
- CI/CD pipelines (faster feedback)

**❌ Use Standard Mode For:**
- Comprehensive responsive testing
- Production deployments
- Final validation before release
- Responsive design work

### Quick Mode Testing Scenarios

#### 1. Quick Development
`pnpm quick:test` - Compare local development against local quick references
- **Use case**: Fast local development workflow
- **URLs**: Local development
- **References**: Local quick reference images
- **Viewport**: lg only (1280x800px)

#### 2. Quick Production Validation
`pnpm quick:test:prod` - Compare production against production quick references
- **Use case**: Fast production validation
- **URLs**: Production
- **References**: Production quick reference images
- **Viewport**: lg only

#### 3. Quick Regression Testing
`pnpm quick:test:cross` - Compare local development against production quick references
- **Use case**: Fast check if local changes break production look
- **URLs**: Local development
- **References**: Production quick reference images
- **Viewport**: lg only

#### 4. Quick Deployment Validation
`pnpm quick:test:prod-cross` - Compare production against local quick references
- **Use case**: Fast verification that production matches expected local state
- **URLs**: Production
- **References**: Local quick reference images
- **Viewport**: lg only

### Quick Mode Commands

**Reference Generation:**
```bash
pnpm quick:reference        # Generate local quick references
pnpm quick:reference:prod   # Generate production quick references
```

**Testing:**
```bash
pnpm quick:test             # Test local against local quick references
pnpm quick:test:prod        # Test production against production quick references
pnpm quick:test:cross       # Test local against production quick references
pnpm quick:test:prod-cross  # Test production against local quick references
```

**Reports and Approval:**
```bash
pnpm quick:approve  # Approve visual differences
pnpm quick:report   # Open HTML report
```

### Flexible Viewport Testing

For maximum flexibility, you can test with ANY single viewport using the `--viewport` parameter:

```bash
# Test with specific viewport
node scripts/backstop-config.js --viewport=xs > backstop.json
node scripts/backstop-config.js --viewport=sm > backstop.json
node scripts/backstop-config.js --viewport=md > backstop.json
node scripts/backstop-config.js --viewport=lg > backstop.json
node scripts/backstop-config.js --viewport=xl > backstop.json
node scripts/backstop-config.js --viewport=xxl > backstop.json
```

**Available Viewports:**
- `xs` - 360x640px (Mobile portrait)
- `sm` - 768x1024px (Tablet portrait)
- `md` - 820x1180px (Tablet landscape)
- `lg` - 1280x800px (Desktop standard)
- `xl` - 1440x900px (Desktop large)
- `xxl` - 1920x1080px (Desktop extra large)

**Combine with Other Modes:**
```bash
# Showcase mode with single viewport
node scripts/backstop-config.js --showcase --viewport=md > backstop.json

# Link-styles already filters to lg automatically
node scripts/backstop-config.js --link-styles > backstop.json
```

### Quick Mode Directory Structure

```
backstop_data/
├── quick_bitmaps_reference_local/     # Git tracked - Local reference images (lg only)
├── quick_bitmaps_reference_production/ # Git tracked - Production reference images (lg only)
├── quick_bitmaps_test/                # Local only - Test results
├── quick_html_report/                 # Local only - HTML reports
└── quick_json_report/                 # Local only - JSON reports
```

**Performance Benefits:**
- **Standard mode**: 6 viewports × 54 scenarios = 324 screenshots
- **Quick mode**: 1 viewport × 54 scenarios = 54 screenshots
- **Time savings**: ~83% reduction in test execution time

**Reference Image Separation:**
Quick mode maintains separate reference images to avoid filename conflicts with standard 6-viewport testing and to allow independent reference management.

## Available Commands

### Testing Commands:
**Standard (All 6 Viewports):**
- `pnpm backstop:test` - Local vs Local references (standard development)
- `pnpm backstop:test:prod` - Production vs Production references (standard validation)
- `pnpm backstop:test:cross` - Local vs Production references (regression testing)
- `pnpm backstop:test:prod-cross` - Production vs Local references (deployment validation)

**Quick (lg Viewport Only - 6x Faster):**
- `pnpm quick:test` - Fast local testing (lg viewport only)
- `pnpm quick:test:prod` - Fast production testing (lg viewport only)
- `pnpm quick:test:cross` - Fast regression testing (lg viewport only)
- `pnpm quick:test:prod-cross` - Fast deployment validation (lg viewport only)

**Showcase (xs and xl Viewports):**
- `pnpm showcase:test` - Showcase local testing
- `pnpm showcase:test:prod` - Showcase production testing
- `pnpm showcase:test:cross` - Showcase cross-environment testing
- `pnpm showcase:test:prod-cross` - Showcase deployment validation

**Link Styles (lg Viewport Only):**
- `pnpm link-styles:test` - Link pseudo-class testing (default, hover, focus)

**Listing View (All 6 Viewports):**
- `pnpm listing-view:test` - Listing view layout testing
- `pnpm listing-view:test:prod` - Listing view production testing

### Reference Management:
- `pnpm backstop:reference` - Update local reference images
- `pnpm backstop:reference:prod` - Update production reference images
- `pnpm backstop:approve` - Approve current test results as new references
- `pnpm backstop:report` - Open HTML report in browser

### Configuration:
- `pnpm backstop:init` - Initialize BackstopJS (run once)

## Test Configuration

- **Viewports:** xs (360x640), sm (768x1024), md (820x1180), lg (1280x800), xl (1440x900), xxl (1920x1080)
- **Engine:** Puppeteer with Chromium
- **Global Hide Selectors:** `.oagbanner` (configured in backstop.base.json)
- **Reference Tolerance:** 0.1% mismatch threshold by default

## Adding New Test Scenarios

1. Edit `backstop.scenarios.json`
2. Add new scenario with both local and production URLs:
```json
{
  "label": "New Page",
  "urls": {
    "local": "http://localhost:8080/oag/new-page",
    "production": "https://devoag.pidwell.com/new-page"
  },
  "features": ["feature-tag"],
  "delay": 1000,
  "selectors": ["document"]
}
```
3. Run tests to generate reference images
4. Commit both the config changes and new reference images

## Troubleshooting

**Tests failing unexpectedly?**
- Check if local Plone instance is running
- Verify URLs are accessible
- Check console output for specific errors

**Authentication issues?**
- Check `backstop_data/engine_scripts/puppet/onBefore.js` for login handling
- Verify local Plone instance credentials
- Update cookies.json with fresh authentication cookies

**Global selectors not being hidden?**
- Verify hideSelectors are in `backstop.base.json` at root level
- Check that scenarios aren't overriding global settings
- Regenerate config after base config changes

## File Structure

```
backstop.scenarios.json          # Scenario definitions
backstop.base.json              # Base configuration
scripts/backstop-config.js      # Simple generator
scripts/a11y-test.js            # axe-core accessibility testing
scripts/hover-contrast-test.js  # Hover-state contrast testing
backstop_data/
  ├── bitmaps_reference_local/   # Local reference images
  ├── bitmaps_reference_production/ # Production reference images
  ├── bitmaps_test/             # Test output images
  ├── html_report/              # Test reports
  ├── a11y_results/             # Accessibility test results (git-ignored)
  │   ├── latest.json           # Most recent JSON results
  │   ├── latest.html           # Most recent HTML report
  │   ├── a11y_YYYY-MM-DD_HH-MM-SS.json  # Timestamped JSON archive
  │   └── a11y_YYYY-MM-DD_HH-MM-SS.html  # Timestamped HTML archive
  ├── hover_contrast_results/   # Hover contrast test results (git-ignored)
  │   └── latest.json           # Most recent JSON results
  └── engine_scripts/           # Puppeteer automation scripts
      └── puppet/
          ├── onBefore.js       # Pre-screenshot setup
          ├── onReady.js        # Post-load actions
          └── cookies.json      # Authentication cookies
```

## Accessibility Testing (axe-core)

Automated WCAG accessibility auditing using [axe-core](https://github.com/dequelabs/axe-core) via Puppeteer. This reuses the same scenarios, authentication, and viewport definitions from the BackstopJS configuration.

### Quick Start

```bash
# Single scenario smoke test (production)
pnpm a11y:test:prod -- --scenario="Homepage"

# All showcase scenarios (local)
pnpm a11y:test:quick

# Color contrast only, showcase scenarios, production
pnpm a11y:test:quick:prod -- --rules=color-contrast

# All scenarios, all viewports, production
pnpm a11y:test:prod -- --all-viewports

# Open the HTML report
pnpm a11y:report
```

### How It Works

The `scripts/a11y-test.js` script:
1. Reads scenarios from `backstop.scenarios.json` (same source as BackstopJS)
2. Launches a single Puppeteer browser instance
3. For each scenario + viewport combination: opens a new page, sets auth headers if `requiresAuth` is true, navigates, waits the scenario's `delay`, then runs axe-core
4. Outputs a PASS/FAIL console summary, a JSON results file, and an HTML report

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--prod` | Use production URLs | local |
| `--scenario=<label>` | Filter scenarios by label (case-insensitive partial match) | all |
| `--feature=<tags>` | Filter by feature tag(s), comma-separated | all |
| `--tags=<axeTags>` | axe rule tags to include (e.g., `wcag2a,wcag2aa,wcag21aa,best-practice`) | all |
| `--rules=<ids>` | Run only specific axe rules (e.g., `color-contrast`) | all |
| `--disable-rules=<ids>` | Exclude specific axe rules | none |
| `--viewport=<label>` | Test with a specific viewport: xs, sm, md, lg, xl, xxl | lg |
| `--all-viewports` | Test all 6 viewports | false |
| `--timeout=<ms>` | Per-page navigation timeout | 30000 |

### npm Scripts

| Command | Description |
|---------|-------------|
| `pnpm a11y:test` | Test all scenarios against local URLs |
| `pnpm a11y:test:prod` | Test all scenarios against production URLs |
| `pnpm a11y:test:quick` | Test showcase scenarios against local URLs |
| `pnpm a11y:test:quick:prod` | Test showcase scenarios against production URLs |
| `pnpm a11y:report` | Open the latest HTML report |

Pass additional flags after `--`:
```bash
pnpm a11y:test:prod -- --scenario="Homepage" --rules=color-contrast
```

### Authentication

Uses the same environment variables as BackstopJS:
- `BACKSTOP_AUTH_USER` — HTTP Basic Auth username
- `BACKSTOP_AUTH_PASS` — HTTP Basic Auth password

Scenarios with `"requiresAuth": true` will have the Authorization header set automatically.

### Output

**Console:** PASS/FAIL summary per scenario with violation details (impact level, rule ID, node count).

**JSON:** `backstop_data/a11y_results/latest.json` (always overwritten) plus timestamped archives (`a11y_YYYY-MM-DD_HH-MM-SS.json`).

**HTML:** `backstop_data/a11y_results/latest.html` (always overwritten) plus timestamped archives (`a11y_YYYY-MM-DD_HH-MM-SS.html`). The HTML report is a unified view with all violations grouped by rule. Each node is annotated with its scenario and viewport for traceability.

JSON and HTML archives from the same run share the same timestamp for easy pairing.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All scenarios passed (no violations) |
| 1 | One or more violations or errors found |
| 2 | Fatal error (script crash) |

### Examples

```bash
# WCAG 2.1 AA only (most common compliance target)
pnpm a11y:test:prod -- --tags=wcag2a,wcag2aa,wcag21aa

# Color contrast audit across all pages
pnpm a11y:test:prod -- --rules=color-contrast

# Single page, mobile viewport
pnpm a11y:test:prod -- --scenario="Homepage" --viewport=xs

# Everything except color-contrast (e.g., focus on structure/ARIA)
pnpm a11y:test:prod -- --disable-rules=color-contrast

# Full comprehensive run (all scenarios, all viewports)
pnpm a11y:test:prod -- --all-viewports
```

### CI/CD Usage

The script exits with code 1 when violations are found, making it suitable for CI pipelines:

```bash
# Fail the build if any WCAG 2.1 AA violations exist
pnpm a11y:test:prod -- --tags=wcag2a,wcag2aa,wcag21aa
```

### Why Default to `lg` Viewport?

Color contrast — the most common accessibility violation — is viewport-independent (same CSS applies at all sizes). Using a single viewport by default keeps runs fast (~54 tests instead of ~324). Use `--all-viewports` for comprehensive runs that catch responsive-specific issues (e.g., content hidden at certain breakpoints, focus traps in mobile menus).

## Hover State Contrast Testing (WCAG SC 1.4.3)

Automated hover-state color contrast checking using Puppeteer. This fills a gap not covered by axe-core or any other open-source CI tool — no existing tool checks contrast ratios after triggering `:hover` states.

### Quick Start

```bash
# Single scenario test (local)
pnpm hover:test -- --scenario="Homepage"

# All scenarios (local)
pnpm hover:test

# All scenarios (production)
pnpm hover:test:prod

# Specific viewport
pnpm hover:test -- --viewport=xs
```

### How It Works

The `scripts/hover-contrast-test.js` script:
1. Reads scenarios from `backstop.scenarios.json` (same source as BackstopJS and axe-core testing)
2. Launches a single Puppeteer browser instance
3. For each scenario: navigates, waits the scenario's `delay`, then injects CSS to disable all transitions and animations
4. **Discovers hoverable elements** via CSSOM `:hover` rule scanning — recursively iterates `document.styleSheets` (including rules inside `@media`, `@supports`, `@layer` blocks) to find all CSS rules containing `:hover`, extracts base selectors (stripping pseudo-elements), and queries matching elements. Falls back to interactive element types (`a[href]`, `button`, etc.) if no `:hover` rules are found
5. **Batch-reads default styles** for all discovered elements in a single `page.evaluate()` call
6. **Hover loop**: for each element, dismisses Bootstrap overlays, resets mouse to neutral `(0, 0)`, re-queries the element handle (stale reference guard), hovers, waits for paint via double-rAF, then reads hover styles
7. **Resolves effective background** by walking the DOM tree and alpha-compositing `rgba()` / `transparent` layers. Bails out with "needs-review" status for `background-image`, gradients, `mix-blend-mode`, or CSS filters
8. **Calculates WCAG 2.1 contrast ratio** using an inline formula (zero external dependencies). Applies 4.5:1 threshold for normal text and 3:1 for large text (>= 24px or >= 18.66px bold)
9. Outputs a PASS/FAIL console summary and JSON results

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--prod` | Use production URLs | local |
| `--scenario=<label>` | Filter scenarios by label (case-insensitive partial match) | all |
| `--viewport=<label>` | Test with a specific viewport: xs, sm, md, lg, xl, xxl | lg |
| `--timeout=<ms>` | Per-page navigation timeout in milliseconds | 30000 |

### npm Scripts

| Command | Description |
|---------|-------------|
| `pnpm hover:test` | Test all scenarios against local URLs |
| `pnpm hover:test:prod` | Test all scenarios against production URLs |

Pass additional flags after `--`:
```bash
pnpm hover:test:prod -- --scenario="Homepage" --viewport=xs
```

### Authentication

Uses the same environment variables as BackstopJS and axe-core testing:
- `BACKSTOP_AUTH_USER` — HTTP Basic Auth username
- `BACKSTOP_AUTH_PASS` — HTTP Basic Auth password

Scenarios with `"requiresAuth": true` will have the Authorization header set via request interception (same-origin only, preventing credential leakage to cross-origin subresources).

### Output

**Console:** PASS/FAIL summary per scenario with violation details (selector, text content, hover contrast ratio vs required ratio).

**JSON:** `backstop_data/hover_contrast_results/latest.json` (always overwritten) and timestamped archive `backstop_data/hover_contrast_results/hover_YYYY-MM-DD_HH-MM-SS.json` (matching a11y-test.js pattern). Contains per-page results with violations, needs-review items, and passes. Each violation includes default-state and hover-state colors, contrast ratios, font size/weight, and the CSS selector path.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All hover states pass contrast requirements |
| 1 | One or more hover-state contrast violations or errors found |
| 2 | Fatal error (script crash) |

### Element Classification

Each element is classified into one of four statuses:

| Status | Meaning |
|--------|---------|
| `pass` | Hover-state contrast meets WCAG threshold |
| `fail` | Hover-state contrast below WCAG threshold |
| `needs-review` | Background could not be determined (gradient, image, blend mode, filter) |
| `skip` | Element disappeared or could not be hovered |

### Known Limitations

- **Background images and gradients**: Flagged as "needs-review" — cannot calculate contrast against images
- **`mix-blend-mode` and CSS `filter`**: Alter visual colors without changing computed styles — flagged for manual review
- **Shadow DOM elements**: Not traversed
- **Iframe content**: Skipped (cross-frame coordination deferred)
- **SVG text elements**: Different style computation — scoped to HTML elements
- **Pseudo-element backgrounds**: `::before`/`::after` with background colors not composited (documented for Phase 2)
