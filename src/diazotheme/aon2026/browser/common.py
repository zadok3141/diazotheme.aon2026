"""Browser utilities for diazotheme.aon2026.

This module provides browser-layer utilities for the AON 2026 theme,
including the SearchSectionView for folder-scoped search.
"""

from ..interfaces import IViewSearchSectionView
from Products.Five.browser import BrowserView
from zope.interface import implementer


@implementer(IViewSearchSectionView)
class SearchSectionView(BrowserView):
    """Allows marking the view with an interface.
    SearchSectionView displays a search box that recursively searches only current
    page's folder. It is used as a landing page in the auditing-standards section.
    """
