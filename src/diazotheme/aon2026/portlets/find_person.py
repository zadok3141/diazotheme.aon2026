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
        portal_state = getMultiAdapter((context, request), name="plone_portal_state")
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
