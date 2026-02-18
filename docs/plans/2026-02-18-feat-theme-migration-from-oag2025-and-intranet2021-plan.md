---
title: "feat: Migrate theme from oag2025 and intranet2021 into aon2026"
type: feat
status: active
date: 2026-02-18
---

# Migrate Theme from oag2025 and intranet2021 into aon2026

## Overview

Migrate selected features from `diazotheme.oag2025` (Plone 6 Diazo theme) and `diazotheme.intranet2021` (Plone 5.2 Diazo theme) into the fresh `diazotheme.aon2026` Cookieplone skeleton using a Big-Bang Copy + Prune approach.

**Sources:**
- `diazotheme.oag2025` at `../diazotheme.oag2025/` -- primary source (Plone 6, SCSS, Bootstrap 5)
- `diazotheme.intranet2021` at `../diazotheme.intranet2021/` -- secondary source (Plone 5.2, LESS, Bootstrap 3)

**Brainstorm:** `docs/brainstorms/2026-02-18-theme-migration-brainstorm.md`

## Problem Statement

The `diazotheme.aon2026` project is a freshly generated Cookieplone skeleton with no theme, no frontend build toolchain, no CSS/JS, and no views. It needs the established development infrastructure and theme assets from `oag2025`, plus specific features from `intranet2021`, adapted for the new intranet site.

## Technical Approach

### Architecture

**Strategy:** Big-Bang Copy + Prune -- copy all selected files at once, rename `oag2025` -> `aon2026` globally, prune excluded features, then layer in `intranet2021` features.

**Key architectural decisions:**
- **No Mosaic dependency** -- strip all Mosaic-related code from copied files (tiles, layout views, monkey-patches, dependencies)
- **SCSS stack** -- root-level `scss/` (Barceloneta base) + `theme/scss/` (theme-specific modules)
- **Webpack + pnpm** -- full frontend build pipeline from oag2025
- **Plone 6.1.3 target** -- all intranet2021 templates must be adapted for Plone 6 APIs

### Rename Mapping

All references must be renamed consistently:

| Pattern | Replacement | Context |
|---------|-------------|---------|
| `diazotheme.oag2025` | `diazotheme.aon2026` | Python imports, ZCML, i18n domain |
| `++theme++oag2025` | `++theme++aon2026` | Theme URLs in rules.xml, manifest.cfg, registry |
| `oag2025-theme` | `aon2026-theme` | Resource bundle name in resources.xml |
| `oag2025.scss` | `aon2026.scss` | Main SCSS entry point filename |
| `oag2025.js` | `aon2026.js` | JS entry point filename |
| `OAG2025 Theme` | `AON2026 Theme` | Human-readable title in manifest.cfg |
| `$oag-*` | `$oag-*` | **Keep as-is for now** -- brand colours renamed in a later task |
| `oagSearchReturn` | Keep as-is | CSS class names preserved for now |

### Implementation Phases

#### Phase 1: Frontend Build Toolchain

Copy and adapt the frontend build infrastructure.

**Files to copy from oag2025 root:**

- [ ] `package.json` -> rename package name, update all `src/diazotheme/oag2025/` paths to `src/diazotheme/aon2026/`, remove `rrssb` from dependencies, remove `macaw-tabs` from devDependencies
- [ ] `postcss.config.js` -> copy as-is (no oag2025 references)
- [ ] `pnpm-workspace.yaml` -> copy as-is
- [ ] `.stylelintrc` -> copy as-is
- [ ] `.stylelintignore` -> copy as-is
- [ ] `webpack/webpack.common.js` -> update entry path from `oag2025` to `aon2026`
- [ ] `webpack/webpack.dev.js` -> copy as-is (references webpack.common.js)
- [ ] `webpack/webpack.prod.js` -> copy as-is
- [ ] `webpack/loaders.js` -> copy as-is
- [ ] `webpack/plugins.js` -> update theme/js path to aon2026
- [ ] `webpack/eslint.config.js` -> copy as-is

**Makefile updates (merge frontend targets into existing Makefile):**

From oag2025 Makefile, extract and adapt any frontend-related targets. The oag2025 Makefile does NOT have frontend targets -- all frontend builds are via `pnpm run` scripts defined in `package.json`. The Makefile stays as-is; document that frontend builds use `pnpm run build`, `pnpm run watch`, etc.

**Verification:** `pnpm install` succeeds, `pnpm run build` compiles CSS and JS.

#### Phase 2: Barceloneta SCSS + Theme Directory Skeleton

**2a. Copy Barceloneta SCSS (root-level `scss/`):**

- [ ] Copy entire `scss/` directory (35 files) from oag2025 root to aon2026 root
  - Includes: `barceloneta.scss`, `barceloneta-toolbar.scss`, `base.scss`, `print.scss`, all `_*.scss` partials, `mixins/` directory, `plone-toolbarlogo.svg`
  - No oag2025-specific references in these files (they are Plone's Barceloneta styles)

**2b. Create Diazo theme directory skeleton:**

- [ ] Create `src/diazotheme/aon2026/theme/` directory
- [ ] Copy from oag2025 `theme/`:
  - `manifest.cfg` -- rename `oag2025` -> `aon2026` in title, rules path, prefix, CSS paths
  - `rules.xml` -- rename `++theme++oag2025` -> `++theme++aon2026`, **strip crossword/quiz/video Diazo rules** (lines 13-38 of oag2025 rules.xml that reference `templates/*.html`)
  - `index.html` -- copy as-is (theme HTML skeleton)
  - `backend.xml` -- rename `++theme++oag2025` -> `++theme++aon2026`
  - `grid-col-marker.xml` -- copy as-is
  - `preview.png` -- copy (replace branding later)
- [ ] Copy `theme/css/` directory (compiled CSS for initial testing)
- [ ] Copy `theme/roboto/` directory (Roboto webfont family)
- [ ] Copy `theme/webfonts/` directory (Font Awesome TTF/WOFF2)
- [ ] Copy `theme/tinymce/` directory (tinymce-formats.css, tinymce-ui-content.css)
- [ ] Copy favicon/apple-touch-icon PNG files from theme root

**2c. Copy theme SCSS modules:**

- [ ] Copy `theme/scss/` directory from oag2025:
  - `oag2025.scss` -> rename to `aon2026.scss`, update `@import`/`@use` paths, remove macaw-elegant-tabs imports
  - `accessibility-fixes.scss` -> copy as-is
  - `annualreport2019.scss` -> copy as-is (prune later)
  - `callout.scss` -> copy as-is
  - `mosaic.scss` -> copy as-is (prune later if Mosaic features not used)
  - `print.scss` -> copy as-is
  - `related-items.scss` -> copy as-is
  - `search-section.scss` -> copy as-is
  - `static-content.scss` -> copy as-is (prune later)
  - `tables.scss` -> copy as-is
  - `macaw-elegant-tabs.css` -> copy as-is (pure CSS, independent of JS)
  - `macaw-elegant-tabs-reset.css` -> copy as-is

**2d. Copy JS entry point:**

- [ ] Copy `theme/js/oag2025.js` -> rename to `theme/js/aon2026.js`
  - Remove `macaw-tabs` import/initialization
  - Remove OAG-specific banner/homepage JS (RandomBanner image cycling, Mosaic banner backgrounds)
  - Keep AutoTOC heading enhancement if generic enough, otherwise strip
  - Keep the IIFE jQuery wrapper structure

**2e. Exclude from theme/ copy:**

- `theme/static/` -- all subdirectories (ar2019, campaign-manager, crosswords, housing-roles, img, mapauditsregion, portsmap-july, quiz, schoolsAuditMap, videos) -- OAG-specific content
- `theme/templates/` -- all files (crossword, quiz, video page templates) -- OAG-specific
- `theme/tinymce-templates/` -- OAG-specific insert templates

**Verification:** Theme directory exists with correct structure. SCSS files parse without errors.

#### Phase 3: ZCML and Python Backend

**3a. Update `configure.zcml` -- add theme registration:**

Add to `src/diazotheme/aon2026/configure.zcml` (before the `<!-- -*- extra stuff goes here -*- -->` marker):

```xml
<include package="plone.resource" />
<include package="plone.app.theming" />
<plone:static
    directory="theme"
    name="aon2026"
    type="theme"
/>
```

Do NOT copy:
- Portlet registration (`diazotheme.oag2025.FeedbackPortlet`)
- Inline GenericSetup profile registrations (aon2026 uses `profiles.zcml`)
- Upgrade step registrations

**3b. Update `interfaces.py` -- add required interfaces:**

Add to `src/diazotheme/aon2026/interfaces.py`:

```python
class IViewSearchSectionView(Interface):
    """Marker interface for search section view."""
```

The `IOag2025Layer` interface from oag2025 is NOT needed -- aon2026 already has `IBrowserLayer`.

**3c. Copy browser Python files (with Mosaic stripping):**

- [ ] Copy `browser/viewlets.py` from oag2025 -> rename imports from `diazotheme.oag2025` to `diazotheme.aon2026`
  - Contains: `SearchSectionViewlet` (only non-Mosaic viewlet)

- [ ] Copy `browser/utils.py` from oag2025 -> rename imports
  - Contains: `embed_url()`, `strip_paragraphs()` -- both generic utilities, no Mosaic deps

- [ ] Copy `browser/common.py` from oag2025 -> **surgically strip Mosaic code:**
  - **KEEP:** `SearchSectionView` class (lines 69-75) -- implements `IViewSearchSectionView`
  - **REMOVE:** `CustomBodyClass` adapter (lines 26-66) -- Mosaic-only
  - **REMOVE:** `get_patched_layout_views()` function -- Mosaic-only
  - **REMOVE:** `apply_patched_layout()` function -- Mosaic-only
  - **REMOVE:** All `plone.app.mosaic` imports
  - **REMOVE:** `FULLWIDTH_LAYOUT_VIEW`, `STANDARD_LAYOUT_VIEW` constants
  - Rename remaining imports from `diazotheme.oag2025` to `diazotheme.aon2026`

**3d. Copy browser templates:**

- [ ] Copy `browser/templates/searchsectionbox.pt` from oag2025 (used by SearchSectionViewlet)
- [ ] Copy `browser/templates/search.pt` from oag2025 (search results page override)
  - Rename any `diazotheme.oag2025` references
- [ ] Do NOT copy Mosaic tile templates (randombanner.pt, hpbanner.pt, etc.)

**3e. Copy browser overrides (5 from oag2025):**

- [ ] `plone.app.contenttypes.behaviors.leadimage.pt` -> copy as-is
- [ ] `plone.app.contenttypes.browser.templates.listing.pt` -> copy as-is
- [ ] `plone.app.layout.viewlets.colophon.pt` -> copy as-is
- [ ] `plone.app.layout.viewlets.searchbox.pt` -> copy as-is (oag2025 version, Bootstrap 5)
- [ ] `plone.app.portlets.portlets.navigation_recurse.pt` -> copy as-is

**3f. Update `browser/configure.zcml`:**

The oag2025 browser/configure.zcml is 263 lines, mostly Mosaic tile registrations. Build a **new** browser/configure.zcml for aon2026 that keeps ONLY:

```xml
<!-- Existing aon2026 skeleton content (jbot + static) -->
<include package="z3c.jbot" file="meta.zcml" />
<browser:jbot directory="overrides" layer="...IBrowserLayer" />
<plone:static directory="static" name="diazotheme.aon2026" type="plone" />

<!-- ADD: Search section view + viewlet from oag2025 -->
<browser:page
    name="search_section_view"
    for="*"
    class=".common.SearchSectionView"
    permission="zope2.View"
    layer="...IBrowserLayer"
/>
<browser:viewlet
    name="diazotheme.aon2026.searchsection"
    for="*"
    view=".common.SearchSectionView"
    manager="plone.app.layout.viewlets.interfaces.IPortalTop"
    class=".viewlets.SearchSectionViewlet"
    permission="zope2.View"
    layer="...IBrowserLayer"
/>

<!-- ADD: Search results page override from oag2025 -->
<browser:page
    name="search"
    class="plone.app.search.browser.Search"
    permission="zope2.View"
    for="*"
    layer="...IBrowserLayer"
    template="templates/search.pt"
/>
```

**REMOVE** from oag2025's browser/configure.zcml (do NOT copy):
- `<include package="plone.tiles" file="meta.zcml" />`
- `<include package="plone.app.contentmenu" />`
- `<include package="collective.monkeypatcher" />`
- All 14 `<plone:tile>` registrations
- `fullwidth_layout_view` browser:page
- `<monkey:patch>` directive
- `<adapter factory=".common.CustomBodyClass" />`
- `navigation_view` browser:page (content listing tile)

**3g. Keep `dependencies.zcml` empty:**

Do NOT copy `<include package="plone.app.mosaic" />` from oag2025.

**3h. Update `profiles/default/metadata.xml`:**

Add theme dependency (keep version at 1000):

```xml
<metadata>
  <version>1000</version>
  <dependencies>
    <dependency>profile-plone.app.theming:default</dependency>
  </dependencies>
</metadata>
```

Do NOT add `plone.app.tiles` or `plone.app.mosaic` dependencies.

**Verification:** `make install` succeeds, `make test` passes, `make lint` passes.

#### Phase 4: GenericSetup Profiles

**4a. Add `profiles/default/theme.xml`:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<theme>
  <name>aon2026</name>
  <enabled>true</enabled>
</theme>
```

**4b. Copy `profiles/default/registry/resources.xml`:**

- [ ] Copy from oag2025, rename `oag2025-theme` bundle to `aon2026-theme`, update JS path from `++theme++oag2025/js/main.min.js` to `++theme++aon2026/js/main.min.js`

**4c. Copy `profiles/default/registry/tinymce.xml`:**

- [ ] Copy from oag2025, rename `++theme++oag2025` paths to `++theme++aon2026`
  - Contains: TinyMCE content CSS, Cite block style, Maori inline style, custom format definitions

**4d. Copy `profiles/default/types/Document.xml`:**

- [ ] Copy from oag2025
  - Adds `search_section_view` to Document's `view_methods`
  - Review: remove `fullwidth_layout_view` (Mosaic-specific)

**4e. Add `profiles/uninstall/theme.xml`:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<theme>
  <name>barceloneta</name>
  <enabled>true</enabled>
</theme>
```

**4f. Do NOT copy:**
- `profiles/default/portlets.xml` (feedbackportlet)
- `profiles/uninstall/portlets.xml`
- `profiles/initial/` directory
- `profiles/upgrades/` directory

**Verification:** `make create-site` creates a themed Plone site.

#### Phase 5: Testing Infrastructure

**5a. Copy testing scripts:**

- [ ] `scripts/backstop-config.js` -> rename all `oag2025` references to `aon2026`
- [ ] `scripts/a11y-test.js` -> rename references
- [ ] `scripts/hover-contrast-test.js` -> rename references
- [ ] `scripts/copy-showcase-references.js` -> rename references
- [ ] `scripts/process-showcase-results.js` -> rename references

**5b. Copy testing config files:**

- [ ] `backstop.base.json` -> copy as-is (viewports and engine config, no OAG-specific content)
- [ ] `backstop.features.json` -> copy as-is (feature keyword registry)
- [ ] `backstop.testing.md` -> copy as-is (documentation)

**5c. Create placeholder scenario file:**

- [ ] Create `backstop.scenarios.json` with a minimal placeholder:

```json
[
  {
    "label": "Homepage",
    "url": "http://localhost:8080/Plone",
    "features": ["homepage"]
  }
]
```

**5d. Do NOT copy:**
- `backstop.scenarios.json` from oag2025 (75+ OAG-specific URLs)
- `backstop.showcase.json` (OAG showcase scenarios)
- `backstop.link-styles.json` (OAG link testing scenarios)
- `backstop.listing-view.json` (OAG listing scenarios)
- `backstop_data/` reference images

**5e. Update `.gitignore`:**

Add BackstopJS output directories:

```
backstop_data/*_test/
backstop_data/*_report/
backstop_data/*html_report/
backstop_data/*json_report/
```

**Verification:** `pnpm run backstop:reference` generates reference screenshots.

#### Phase 6: Intranet2021 Features

**6a. Intranet2021 searchbox override:**

The oag2025 already provides `plone.app.layout.viewlets.searchbox.pt` (Bootstrap 5, Plone 6 compatible). The intranet2021 version adds a "find a person" checkbox but uses Plone 5 HTML structure.

- [ ] Copy intranet2021 searchbox as `browser/overrides/searchbox-intranet2021.pt.reference` (reference file, NOT active jbot override)
- [ ] The "find a person" feature will be manually merged into the oag2025 searchbox in a future task

**6b. Intranet2021 folder listing override:**

The intranet2021 `plone.app.dexterity.browser.folder_listing.pt` is a Plone 5 template. In Plone 6, folder listing is provided by `plone.app.contenttypes`. The oag2025 already overrides `plone.app.contenttypes.browser.templates.listing.pt`.

- [ ] Copy intranet2021 folder_listing as `browser/overrides/folder-listing-intranet2021.pt.reference` (reference file)
- [ ] The thumbnail and byline features will be merged into the existing oag2025 listing override in a future task (requires Plone 6 API adaptation: different jbot path, different template APIs)

**6c. Schools & Auditors interactive map:**

- [ ] Copy entire `theme/static/schoolsAndAuditors/` directory from intranet2021 to `src/diazotheme/aon2026/theme/static/schoolsAndAuditors/`
- [ ] Add Diazo `notheme` rule to `rules.xml` for the map page (if accessed directly):

```xml
<notheme css:if-content="#schools-auditors-map" />
```

Or add a path-based notheme rule if the map is accessed via a known URL pattern.

- [ ] Note: The map bundles Font Awesome 7, which differs from the theme's Font Awesome 6. Since the map is a self-contained SPA, this is acceptable -- the versions are isolated.

**Verification:** Reference files are present. Schools map directory copied. Diazo notheme rule added.

#### Phase 7: Final Verification and Cleanup

**7a. Global rename verification:**

- [ ] Run `grep -r "oag2025" src/ scss/ webpack/ scripts/ *.json *.yaml` to find any missed references
- [ ] Run `grep -r "diazotheme\.oag2025" src/` to verify Python package references are renamed
- [ ] Run `grep -r "++theme++oag2025" src/` to verify theme URL references are renamed

**7b. Build verification:**

- [ ] `pnpm install` -- installs Node.js dependencies
- [ ] `pnpm run build` -- compiles CSS and JS
- [ ] `make install` -- sets up Python venv and Zope instance
- [ ] `make test` -- all pytest tests pass
- [ ] `make lint` -- no lint errors
- [ ] `make format` -- code is formatted
- [ ] `make create-site` -- Plone site created with theme enabled

**7c. Runtime verification:**

- [ ] `make start` -- Plone starts on localhost:8080
- [ ] Visit `http://localhost:8080/Plone` -- theme is visually applied
- [ ] Verify SearchSectionView is accessible
- [ ] Verify browser overrides are active (check colophon, searchbox, listing, navigation, leadimage)
- [ ] Verify schools map at `http://localhost:8080/Plone/++theme++aon2026/static/schoolsAndAuditors/index.html`

**7d. Cleanup:**

- [ ] Remove any `.gitkeep` files that are now in non-empty directories
- [ ] Update `CLAUDE.md` with new architecture notes (frontend build commands, theme structure)
- [ ] Add a news fragment to `news/` for the migration

## Acceptance Criteria

### Functional Requirements

- [ ] Theme is registered and activates when the addon is installed
- [ ] Theme deactivates (falls back to barceloneta) when the addon is uninstalled
- [ ] SearchSectionViewlet renders on pages using the search_section_view
- [ ] All 5 browser overrides from oag2025 are active (leadimage, listing, colophon, searchbox, navigation_recurse)
- [ ] Schools & Auditors map loads as a standalone page
- [ ] TinyMCE editor shows custom formats (Maori, Cite) and custom content CSS
- [ ] JS bundle loads on themed pages (Bootstrap 5, Font Awesome 6)

### Non-Functional Requirements

- [ ] `make install` completes without errors
- [ ] `make test` -- all tests pass (existing 5 + any new)
- [ ] `make lint` -- no lint violations
- [ ] `pnpm install` -- no dependency resolution errors
- [ ] `pnpm run build` -- CSS and JS compile successfully
- [ ] No `plone.app.mosaic` imports or dependencies remain
- [ ] No `oag2025` string references remain in source files (except `.reference` files and comments)
- [ ] Profile version remains at `1000`

### Quality Gates

- [ ] `grep -r "oag2025" src/ scss/ webpack/ scripts/` returns no results (excluding .reference files)
- [ ] `make check` (format + lint) passes cleanly
- [ ] Plone site starts and serves themed pages

## Dependencies & Prerequisites

- `diazotheme.oag2025` source at `../diazotheme.oag2025/` -- must be accessible
- `diazotheme.intranet2021` source at `../diazotheme.intranet2021/` -- must be accessible
- Node.js and pnpm installed on the system
- Python 3.10+ and uv installed

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed `oag2025` reference breaks build | Medium | High | Global grep verification in Phase 7 |
| Mosaic import left in copied code causes startup failure | Medium | High | Explicit ZCML line-by-line audit; test `make install` early |
| Intranet2021 Plone 5 templates incompatible with Plone 6 | High | Medium | Store as `.reference` files; port in future task |
| Font Awesome 6 vs 7 conflict on map pages | Low | Low | Map is self-contained SPA with isolated deps |
| SCSS import paths break after directory reorganization | Medium | Medium | Test `pnpm run build` after each phase |
| BackstopJS scenarios empty, testing non-functional | Low | Low | Placeholder scenario created; real scenarios added when site has content |

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-18-theme-migration-brainstorm.md`
- oag2025 WCAG color plan: `../diazotheme.oag2025/planning/plan_2025-12-23_wcag-colors.md`
- oag2025 hover contrast plan: `../diazotheme.oag2025/docs/plans/2026-02-16-feat-hover-contrast-checker-plan.md`
- oag2025 BackstopJS quick mode: `../diazotheme.oag2025/planning/plan_2025-11-17.md`

### Key Source Files

- oag2025 package.json: `../diazotheme.oag2025/package.json`
- oag2025 webpack config: `../diazotheme.oag2025/webpack/`
- oag2025 browser/configure.zcml: `../diazotheme.oag2025/src/diazotheme/oag2025/browser/configure.zcml` (263 lines -- audit carefully)
- oag2025 common.py: `../diazotheme.oag2025/src/diazotheme/oag2025/browser/common.py` (strip Mosaic code)
- oag2025 theme manifest: `../diazotheme.oag2025/src/diazotheme/oag2025/theme/manifest.cfg`
- intranet2021 searchbox: `../diazotheme.intranet2021/src/diazotheme/intranet2021/browser/overrides/plone.app.layout.viewlets.searchbox.pt`
- intranet2021 folder listing: `../diazotheme.intranet2021/src/diazotheme/intranet2021/browser/overrides/plone.app.dexterity.browser.folder_listing.pt`
- intranet2021 schools map: `../diazotheme.intranet2021/src/diazotheme/intranet2021/theme/static/schoolsAndAuditors/`
