# Changelog

## 1.0.1 (unreleased)


- Upgrade the dev environment to Plone 6.2.0: Makefile `PLONE_VERSION`
  6.1.3 -> 6.2.0, `cookiecutter-zope-instance` 2.1.1 -> 3.1.0 (2.x predates
  Zope 6.1), and `mx.ini` version-overrides carrying the eight post-6.2.0
  security pins (PSA-20260605, PSA-20260623).
- Drop `collective.anonymouseditpatterns` from the runtime dependencies —
  last released 2022, Plone 5.2 only, no Plone 6 release exists; the egg is
  removed from the aon2026 buildout in the 6.2.0 upgrade. Referenced nowhere
  in `src/` or the GenericSetup profiles.
- Fix the favicon Diazo rules: Plone 6.2.0's `favicon.pt` emits
  `rel="icon"` (was `rel="preload icon"`), so drop with `rel~='icon'`
  (matches both); also correct the `mark-icon` typo so the `mask-icon`
  drop rule actually fires. Mirrors diazotheme.oag2025 (`7add12e`,
  `00a683c`).


## 1.0.0 (2025-11-30)

# Initial launch state May 2026.

- Initial release.
