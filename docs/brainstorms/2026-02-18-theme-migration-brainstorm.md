# Theme Migration Brainstorm

**Date:** 2026-02-18
**Status:** Approved

## What We're Building

Migrating selected features from two existing Diazo theme projects into the new `diazotheme.aon2026` Cookieplone skeleton:

- **diazotheme.oag2025** (Plone 6, SCSS, Bootstrap 5) — primary source for build tooling, theme structure, CSS/JS, testing infrastructure
- **diazotheme.intranet2021** (Plone 5.2, LESS, Bootstrap 3) — secondary source for specific browser overrides and static content

## Why This Approach

**Big-Bang Copy + Prune:** Copy all selected oag2025 features at once into aon2026, rename all `oag2025` references to `aon2026`, then layer in intranet2021 features. This is the fastest path to a working theme that can be tested and iteratively refined.

## Key Decisions

### From oag2025 — INCLUDE

| Category | What to bring | Notes |
|----------|--------------|-------|
| **Build toolchain** | pnpm, Webpack 5, Sass (SCSS), PostCSS, clean-css, ESLint, Stylelint, Babel, nodemon | Full stack as-is |
| **Build configs** | package.json, postcss.config.js, pnpm-workspace.yaml, webpack/*.js, .stylelintrc, .stylelintignore | Rename oag2025 refs |
| **Testing** | BackstopJS (config generator, base config, viewports), axe-core a11y, hover contrast testing | All three tools, clear OAG scenarios |
| **Testing scripts** | scripts/backstop-config.js, scripts/a11y-test.js, scripts/hover-contrast-test.js, scripts/copy-showcase-references.js, scripts/process-showcase-results.js | Rename refs |
| **Barceloneta SCSS** | Full scss/ directory (30+ files: base, grid, header, footer, forms, etc.) | Core theme foundation |
| **Theme SCSS** | All OAG SCSS modules: oag2025.scss, accessibility-fixes, annualreport2019, callout, mosaic, print, related-items, search-section, static-content, tables, macaw tabs CSS | Copy all, rename/rebrand later |
| **Diazo theme** | rules.xml, index.html, backend.xml, manifest.cfg, grid-col-marker.xml | Full theme skeleton |
| **TinyMCE** | tinymce/tinymce-formats.css, tinymce/tinymce-ui-content.css | Editor styling |
| **Favicons** | All apple-touch-icon PNGs, favicon files | Replace branding later |
| **Web fonts** | Roboto (theme/roboto/), Font Awesome (theme/webfonts/) | As-is |
| **Compiled CSS** | theme/css/ directory (theme.css, toolbar CSS, minified versions) | For initial testing |
| **JS entry** | theme/js/oag2025.js (rename to aon2026.js) | Remove macaw-tabs, rrssb imports |
| **JS deps** | Bootstrap 5, Font Awesome 6 | Only these two |
| **Browser views** | SearchSectionViewlet + template | Rename refs |
| **Browser overrides** | leadimage, listing, colophon, searchbox, navigation_recurse (5 overrides) | As-is |
| **Browser utils** | common.py, utils.py (embed_url, strip_paragraphs) | Utility functions |
| **GenericSetup** | theme.xml, registry/tinymce.xml, registry/resources.xml, types/Document.xml | Skip portlets.xml |
| **Makefile targets** | Frontend build targets (css, js, watch, lint-js, lint-css, etc.) | Merge with existing |
| **CI config** | .github-notused/ workflows | Reference for later |

### From oag2025 — EXCLUDE

| Category | What to skip | Reason |
|----------|-------------|--------|
| **Mosaic tiles** | All 14 tiles (tiles.py + templates) | Not needed for intranet |
| **Static content** | theme/static/ (crosswords, quiz, maps, videos, campaign manager) | OAG-specific interactive content |
| **Templates** | theme/templates/ (annual reports, crosswords, quiz, videos) | OAG-specific page templates |
| **TinyMCE templates** | theme/tinymce-templates/ | OAG-specific insert templates |
| **Portlets** | feedbackportlet.py, portlets.xml | OAG-specific |
| **Upgrade steps** | upgrades/ (1000->1001) | Start fresh |
| **mx.ini deps** | oag.portlets.reports | OAG-specific dependency |
| **Example content** | setuphandlers/initial.py + content data | OAG-specific |
| **rrssb** | Social sharing JS library | Not needed |
| **macaw-tabs** | Tab component JS library | Not needed |
| **BackstopJS scenarios** | backstop.scenarios.json (75+ OAG page URLs) | Need new scenarios for intranet |

### From intranet2021 — INCLUDE

| Category | What to bring | Notes |
|----------|--------------|-------|
| **Search box override** | plone.app.layout.viewlets.searchbox.pt | Rename to avoid collision with oag2025 version; both exist |
| **Folder listing override** | plone.app.dexterity.browser.folder_listing.pt | New — not in oag2025 |
| **Schools map** | theme/static/schoolsAndAuditors/ (entire Observable Framework app) | Copy as-is into new theme |

### From intranet2021 — EXCLUDE (for now)

| Category | What to skip | Reason |
|----------|-------------|--------|
| **CSS features** | pullquote, callout, image-grid, table styles, videoWrapper, etc. | Review and port later as needed |
| **TinyMCE config** | Custom formats, style_formats registry | Review later |
| **LESS stack** | All LESS files, vendored Barceloneta | Using oag2025 SCSS instead |
| **Build tooling** | Yarn, Webpack (LESS-based) | Using oag2025 pnpm + SCSS stack |
| **Robot tests** | Robot Framework acceptance tests | Using BackstopJS instead |

## Collision Handling

Both oag2025 and intranet2021 have a `searchbox.pt` override. The oag2025 version is already selected for inclusion. The intranet2021 version adds a "find a person" feature. Strategy:

- Keep oag2025 searchbox as the primary override (standard filename for z3c.jbot)
- Bring intranet2021 searchbox as a reference file (e.g., `searchbox-intranet.pt.reference`) for later manual integration of the "find a person" feature

## Renaming Strategy

All references to `oag2025` will be renamed to `aon2026`:
- Python imports and package references
- ZCML registrations
- SCSS file names and variable prefixes
- JS entry point filename
- Theme manifest paths
- GenericSetup profile references
- BackstopJS config references
- Brand colour variable names ($oag-* -> $aon-* or similar)

## Open Questions

None — all key decisions have been made.

## Migration Order (Big-Bang)

1. **Copy build toolchain** — package.json, webpack/, postcss.config.js, .stylelintrc, pnpm-workspace.yaml
2. **Copy barceloneta SCSS** — scss/ directory
3. **Copy Diazo theme skeleton** — theme/ directory (rules.xml, index.html, backend.xml, manifest.cfg, fonts, favicons, tinymce, compiled CSS)
4. **Copy theme SCSS** — theme/scss/ directory
5. **Copy JS** — theme/js/ entry point
6. **Copy browser views** — viewlets.py, common.py, utils.py, templates, overrides
7. **Copy GenericSetup profiles** — theme.xml, registry/*.xml, types/Document.xml
8. **Copy testing scripts** — scripts/backstop-config.js, a11y-test.js, hover-contrast-test.js, etc.
9. **Copy testing configs** — backstop.base.json, backstop.features.json, backstop.testing.md
10. **Rename all oag2025 -> aon2026** — global find/replace across all copied files
11. **Add intranet2021 features** — searchbox reference, folder listing override, schools map
12. **Update Makefile** — merge frontend build targets
13. **Install and verify** — pnpm install, make install, build CSS/JS, run tests
