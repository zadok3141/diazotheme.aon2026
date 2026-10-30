# Changelog

## 1.1.0 (2026-10-30)


- Figure and table captions now sit above the figure or table, matching the
   public site (ported from diazotheme.oag2025, DO-12); add `.caption-bottom`
   in hand-authored markup to keep one below. `.table-borderless` and
   `table.invisible-grid` get the public site's cell spacing. No existing
   intranet content moves: the 2026-10-06 export has no `<caption>` or
   `<figcaption>`. (DA-2)

- Replace the favicon set with icons drawn from the intranet logo (seafoam
   `#53c0a3` house/speech-bubble/monitor glyph) instead of the superseded 2021
   mark: add the missing `aon2026-favicon.svg` (was a 404) and redraw
   `aon2026-favicon.ico` and `aon2026-apple-touch-icon.png`. Remove the five
   unreferenced `aon2026-apple-touch-icon-*precomposed.png` files. (DA-1)

- `dl_backup.env`: restores now download from
   `s3://oag-backups/from_intranet.ao.parliament.nz/` (the new instance)
   instead of `from_wpintranet03.oag.net`.


## 1.0.1 (2026-09-02)


- dl_backup.sh script is now standardized across projects.

- fix: favicon Diazo drop rules for Plone 6.2.0

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
