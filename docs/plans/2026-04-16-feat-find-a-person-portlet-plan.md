---
title: "feat: Add Find a Person portlet"
type: feat
status: completed
date: 2026-04-16
---

# feat: Add Find a Person Portlet

## Overview

Add a "Find a Person" portlet to diazotheme.aon2026 — a search box that restricts results to the `/Members` folder. Structurally a copy of the Plone search portlet (`plone.app.portlets.portlets.search`) with a hardcoded path restriction and different labelling.

## Problem Statement / Motivation

Users of the OAG intranet need a quick way to find people (member profiles). Currently, the site-wide search returns all content types. A dedicated "Find a Person" portlet in the sidebar provides a focused search experience scoped to the Members folder.

## Proposed Solution

Create a new portlet in a `portlets/` subpackage that mirrors the Plone search portlet structure, adding a hidden `path` field to restrict catalog queries to `/Members`. Register it via ZCML and GenericSetup so site admins can add it to any column manager.

## Technical Approach

### Key Design Decisions

1. **Path computation**: The hidden `path` field must contain the full physical path (e.g., `/Plone/Members`), not just `/Members`. The Renderer computes this dynamically via `portal.Members.getPhysicalPath()` to handle varying Zope site IDs across environments.

2. **Livesearch**: Drop the `enableLivesearch` config field entirely. Livesearch's `pat-livesearch` AJAX calls do NOT include hidden form fields, so live results would show all site content while submitted results would be restricted to `/Members` — a confusing mismatch. Simpler to omit livesearch for this portlet.

3. **No configurable fields**: Since path is hardcoded and livesearch is omitted, there are no user-configurable fields. Use `NullAddForm` (no add form fields, no edit form needed).

4. **Template changes from search portlet**:
   - Header: "Find a Person" instead of "Search"
   - Placeholder: "Find a person" instead of "Search Site"
   - Hidden `path` field added (hardcoded to Members physical path)
   - "Advanced Search..." footer link removed (not useful for a people-scoped search)
   - No livesearch markup

5. **portlets.xml**: Register for `IColumn` (left/right columns), not `IDashboard`.

6. **Upgrade step**: Bump profile version from `1000` to `1001` with upgrade step that imports `portlets.xml`.

### Files to Create

| File | Purpose |
|------|---------|
| `src/diazotheme/aon2026/portlets/__init__.py` | Empty package init |
| `src/diazotheme/aon2026/portlets/configure.zcml` | `<plone:portlet>` registration |
| `src/diazotheme/aon2026/portlets/find_person.py` | `IFindPersonPortlet`, `Assignment`, `Renderer`, `AddForm` |
| `src/diazotheme/aon2026/portlets/find_person.pt` | Portlet template |
| `src/diazotheme/aon2026/profiles/default/portlets.xml` | GenericSetup portlet type registration |
| `tests/portlets/__init__.py` | Test package init |
| `tests/portlets/test_find_person.py` | Portlet registration and renderer tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/diazotheme/aon2026/configure.zcml` | Add `<include package=".portlets" />` before marker |
| `src/diazotheme/aon2026/profiles/default/metadata.xml` | Bump version to `1001` |
| `src/diazotheme/aon2026/upgrades/configure.zcml` | Register upgrade step 1000 → 1001 |

### Implementation Details

#### `find_person.py` — Portlet Classes

```python
# src/diazotheme/aon2026/portlets/find_person.py

from diazotheme.aon2026 import _
from plone.app.portlets.portlets import base
from plone.portlets.interfaces import IPortletDataProvider
from Products.Five.browser.pagetemplatefile import ViewPageTemplateFile
from zope.component import getMultiAdapter
from zope.interface import implementer


class IFindPersonPortlet(IPortletDataProvider):
    """A portlet displaying a people search box restricted to /Members."""


@implementer(IFindPersonPortlet)
class Assignment(base.Assignment):
    @property
    def title(self):
        return _("Find a Person")


class Renderer(base.Renderer):
    render = ViewPageTemplateFile("find_person.pt")

    def __init__(self, context, request, view, manager, data):
        base.Renderer.__init__(self, context, request, view, manager, data)
        portal_state = getMultiAdapter(
            (context, request), name="plone_portal_state"
        )
        self.navigation_root_url = portal_state.navigation_root_url()
        portal = portal_state.portal()
        members = getattr(portal, "Members", None)
        if members is not None:
            self.members_path = "/".join(members.getPhysicalPath())
        else:
            self.members_path = ""

    @property
    def available(self):
        return bool(self.members_path)

    def search_action(self):
        return f"{self.navigation_root_url}/@@search"


class AddForm(base.NullAddForm):
    def create(self):
        return Assignment()
```

#### `find_person.pt` — Portlet Template

```xml
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:i18n="http://xml.zope.org/namespaces/i18n"
      xmlns:tal="http://xml.zope.org/namespaces/tal"
      tal:omit-tag=""
      i18n:domain="diazotheme.aon2026"
>

  <div class="card portlet portletFindPerson">

    <div class="card-header">
      <span class="tile" i18n:translate="">Find a Person</span>
    </div>

    <div class="card-body">
      <form id="findpersonform"
            action="search"
            style="min-width: auto;"
            tal:attributes="action view/search_action"
      >
        <input name="path"
               type="hidden"
               tal:attributes="value view/members_path"
        />
        <div class="input-group">
          <input class="form-control"
                 name="SearchableText"
                 placeholder="Find a person"
                 title="Find a Person"
                 type="text"
                 tal:attributes="value request/SearchableText|nothing"
                 i18n:attributes="title; placeholder"
          />
          <div class="input-group-append">
            <button class="btn btn-primary"
                    type="submit"
                    i18n:translate=""
            >Search</button>
          </div>
        </div>
      </form>
    </div>

  </div>

</html>
```

#### `configure.zcml` — Portlet Registration

```xml
<configure
    xmlns="http://namespaces.zope.org/zope"
    xmlns:plone="http://namespaces.plone.org/plone"
    >

  <include package="plone.app.portlets" />

  <!-- -*- extra stuff goes here -*- -->

  <plone:portlet
      name="diazotheme.aon2026.portlets.FindPersonPortlet"
      interface=".find_person.IFindPersonPortlet"
      assignment=".find_person.Assignment"
      renderer=".find_person.Renderer"
      addview=".find_person.AddForm"
      view_permission="zope2.View"
      edit_permission="cmf.ManagePortal"
      />

</configure>
```

#### `portlets.xml` — GenericSetup Registration

```xml
<?xml version="1.0" encoding="utf-8"?>
<portlets>
  <portlet addview="diazotheme.aon2026.portlets.FindPersonPortlet"
           title="Find a Person"
           description="A search portlet restricted to the Members folder."
  >
    <for interface="plone.app.portlets.interfaces.IColumn" />
  </portlet>
</portlets>
```

#### Upgrade Step (1000 → 1001)

Add to `upgrades/configure.zcml` (before the marker comment, replacing the commented-out example):

```xml
<genericsetup:upgradeSteps
    profile="diazotheme.aon2026:default"
    source="1000"
    destination="1001"
    >
  <genericsetup:upgradeDepends
      title="Register Find a Person portlet"
      import_steps="portlets"
      />
</genericsetup:upgradeSteps>
```

No Python upgrade step file needed — `upgradeDepends` with `import_steps="portlets"` re-imports `portlets.xml` from the default profile directly. Also bump `metadata.xml` version to `1001`.

## Acceptance Criteria

- [x] Portlet appears in "Add portlet..." dropdown when managing column portlets
- [x] Portlet renders a search box titled "Find a Person" with placeholder "Find a person"
- [x] Submitting the form goes to `@@search` with `path` set to the physical Members path
- [x] Search results are restricted to content within `/Members`
- [x] Portlet does not render if `/Members` folder does not exist
- [x] No livesearch (no AJAX suggestions on typing)
- [x] Upgrade step 1000 → 1001 imports portlets.xml correctly
- [x] All tests pass: registration, renderer, template rendering

## Edge Cases

- **Members folder doesn't exist**: `available` returns `False`, portlet is hidden
- **Empty search query**: Submits to `@@search` with `path=/Plone/Members` and empty `SearchableText` — shows all members (acceptable)
- **Non-standard Zope site ID**: Path is computed dynamically from `getPhysicalPath()`, so `Plone` vs `plone` vs custom ID all work

## References

### Internal
- Plone search portlet: `.venv/.../plone/app/portlets/portlets/search.py` (70 lines)
- Existing section search template: `src/diazotheme/aon2026/browser/templates/searchsectionbox.pt` (hidden path field pattern)
- Reference portlet project: `../oag.portlets.reports/src/oag/portlets/reports/portlets/` (ZCML + profile registration)

### Brainstorm
- `docs/brainstorms/2026-04-16-find-a-person-portlet-brainstorm.md`
