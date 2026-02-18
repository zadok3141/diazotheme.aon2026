# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Plone 6 Diazo theme addon (`diazotheme.aon2026`) for the OAG intranet site. Generated with Cookieplone. Uses the standard Plone addon structure with namespace packages (`diazotheme.aon2026`).

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (package manager)
- Make

## Common Commands

```bash
make install          # Set up venv, install deps, configure Zope instance
make start            # Run Plone on localhost:8080
make test             # Run pytest suite
make test-coverage    # Run tests with coverage report
make check            # Format + lint (runs both targets below)
make format           # Ruff format + isort + zpretty on XML/ZCML
make lint             # Ruff check + pyroma + check-python-versions + zpretty --check
make create-site      # Create a new Plone site (after install)
make i18n             # Regenerate translation files
make clean            # Remove venv and build artifacts (preserves data)
```

Run a single test:
```bash
.venv/bin/pytest tests/setup/test_setup_install.py::TestSetupInstall::test_addon_installed -v
```

Add a bobtemplates.plone subtemplate (content type, behavior, etc.):
```bash
make add content_type
make add behavior
```

## Code Quality

- **Formatter/Linter**: Ruff (config in `pyproject.toml`), line length 88, target Python 3.10
- **Import style**: Force single-line, from-first, no sections, case-insensitive sort
- **XML/ZCML formatting**: zpretty
- **Code style**: Black-compatible via Ruff

## Architecture

### Package Layout (`src/diazotheme/aon2026/`)

- `configure.zcml` — Root ZCML; includes sub-packages and registers translations
- `interfaces.py` — `IBrowserLayer` marker interface for this addon's browser layer
- `browser/` — Views, templates, static resources; overrides go in `browser/overrides/`
- `content/` — Content type schemas and classes
- `controlpanels/` — Plone control panel registrations
- `indexers/` — Catalog index adapters
- `vocabularies/` — Named vocabularies
- `profiles/default/` — GenericSetup install profile (current version: `1000`)
- `profiles/uninstall/` — GenericSetup uninstall profile
- `upgrades/` — Upgrade steps between profile versions (source→destination pattern)
- `locales/` — i18n message catalogs; domain is `diazotheme.aon2026`
- `testing.py` — Plone test layers (INTEGRATION, FUNCTIONAL, ACCEPTANCE)

### Testing

- Framework: pytest + pytest-plone
- Test layers defined in `testing.py`, fixtures wired via `conftest.py` using `fixtures_factory`
- Tests use fixtures like `installer`, `browser_layers`, `profile_last_version` (from pytest-plone)
- Test directory: `tests/` with subdirectories by category (e.g., `tests/setup/`)

### Key Conventions

- ZCML files contain `<!-- -*- extra stuff goes here -*- -->` markers for bobtemplates.plone code generation — do not remove these
- Version is managed in `src/diazotheme/aon2026/__init__.py` (read by hatchling)
- Changelog uses towncrier: add news fragments to `news/` directory, not directly to `CHANGELOG.md`
- Dependencies are constrained via mxdev (`mx.ini`) against Plone's official constraints
- The Zope instance config is generated from `instance.yaml` via cookiecutter-zope-instance

## Authoritative Documentation

- `README.md` — Installation and contribution guide
- `CHANGELOG.md` — Release history (managed by towncrier)
- `CLAUDE.md` — This file
