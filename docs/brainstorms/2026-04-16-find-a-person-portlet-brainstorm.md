---
date: 2026-04-16
topic: find-a-person-portlet
---

# Find a Person Portlet

## What We're Building

A "Find a Person" portlet — structurally a copy of the Plone search portlet with two differences:

1. **Hardcoded path restriction** to `/Members` — the search form submits to `@@search` with a `path` parameter pre-set
2. **Different heading/styling** — titled "Find a Person" instead of "Search"

Everything else follows the search portlet pattern: `IPortletDataProvider` schema, Assignment, Renderer, AddForm, EditForm, and a `.pt` template.

## Why This Approach

The standard Plone search portlet is the closest existing pattern. Rather than building something from scratch or overcomplicating with configurable path restrictions, we copy the proven pattern and hardcode the `/Members` path. This keeps the portlet simple and purpose-built.

Reference project `oag.portlets.reports` was consulted for the portlet registration pattern (ZCML, profile), but its architecture (context-sensitive metadata extraction, NullAddForm, caching) is far more complex than what's needed here.

## Key Decisions

- **Path restriction**: Hardcoded to `/Members`, not configurable via add/edit form
- **Search results**: Standard `@@search` page with path filter pre-applied
- **LiveSearch**: Keep the `enableLivesearch` toggle from the search portlet
- **Portlet manager**: No new portlet manager — use existing Plone column managers
- **Profile registration**: No `portlets.xml` needed unless auto-assignment is required

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/diazotheme/aon2026/portlets/__init__.py` |
| Create | `src/diazotheme/aon2026/portlets/find_a_person.py` |
| Create | `src/diazotheme/aon2026/portlets/find_a_person.pt` |
| Create | `src/diazotheme/aon2026/portlets/configure.zcml` |
| Modify | `src/diazotheme/aon2026/configure.zcml` (include portlets subpackage) |

## Open Questions

- None — requirements are clear

## Next Steps

-> `/workflows:plan` for implementation details
