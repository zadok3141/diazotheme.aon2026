from plone.app.layout.viewlets.common import SearchBoxViewlet
from Products.Five.browser.pagetemplatefile import ViewPageTemplateFile


class SearchSectionViewlet(SearchBoxViewlet):
    """Search widget restricted to current section"""

    index = ViewPageTemplateFile("templates/searchsectionbox.pt")
