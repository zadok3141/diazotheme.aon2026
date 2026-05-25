from diazotheme.aon2026.portlets import find_person
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID
from plone.portlets.interfaces import IPortletAssignment
from plone.portlets.interfaces import IPortletDataProvider
from plone.portlets.interfaces import IPortletManager
from plone.portlets.interfaces import IPortletRenderer
from plone.portlets.interfaces import IPortletType
from zope.component import getMultiAdapter
from zope.component import getUtility

import pytest


PORTLET_NAME = "diazotheme.aon2026.portlets.FindPersonPortlet"


class TestPortletRegistration:
    """Test portlet type registration."""

    def test_portlet_type_registered(self, integration):
        portlet = getUtility(IPortletType, name=PORTLET_NAME)
        assert portlet.addview == PORTLET_NAME

    def test_registered_for_column(self, integration):
        from Products.GenericSetup.utils import _getDottedName

        portlet = getUtility(IPortletType, name=PORTLET_NAME)
        registered = [_getDottedName(i) for i in portlet.for_]
        assert "plone.app.portlets.interfaces.IColumn" in registered

    def test_assignment_interfaces(self, integration):
        assignment = find_person.Assignment()
        assert IPortletAssignment.providedBy(assignment)
        assert IPortletDataProvider.providedBy(assignment.data)

    def test_assignment_title(self, integration):
        assignment = find_person.Assignment()
        assert assignment.title == "Find a Person"


class TestPortletRenderer:
    """Test portlet renderer with Members folder present."""

    @pytest.fixture(autouse=True)
    def _create_members_folder(self, portal):
        if "Members" not in portal.objectIds():
            setRoles(portal, TEST_USER_ID, ["Manager"])
            portal.invokeFactory("Folder", "Members", title="Members")
            setRoles(portal, TEST_USER_ID, ["Member"])

    @pytest.fixture()
    def renderer(self, portal, http_request):
        view = portal.restrictedTraverse("@@plone")
        manager = getUtility(IPortletManager, name="plone.leftcolumn", context=portal)
        assignment = find_person.Assignment()
        return getMultiAdapter(
            (portal, http_request, view, manager, assignment),
            IPortletRenderer,
        )

    def test_renderer_type(self, renderer):
        assert isinstance(renderer, find_person.Renderer)

    def test_renderer_available(self, renderer):
        assert renderer.available is True

    def test_members_path(self, renderer, portal):
        expected = "/".join(portal.Members.getPhysicalPath())
        assert renderer.members_path == expected

    def test_search_action(self, renderer):
        assert renderer.search_action().endswith("/@@search")

    def test_render(self, renderer):
        renderer.update()
        html = renderer.render()
        assert "portletFindPerson" in html
        assert "Find a Person" in html
        assert 'name="path"' in html
        assert 'name="SearchableText"' in html


class TestPortletRendererNoMembers:
    """Test renderer when Members folder does not exist."""

    @pytest.fixture()
    def renderer(self, portal, http_request):
        if "Members" in portal.objectIds():
            portal.manage_delObjects(["Members"])
        view = portal.restrictedTraverse("@@plone")
        manager = getUtility(IPortletManager, name="plone.leftcolumn", context=portal)
        assignment = find_person.Assignment()
        return getMultiAdapter(
            (portal, http_request, view, manager, assignment),
            IPortletRenderer,
        )

    def test_not_available(self, renderer):
        assert renderer.available is False

    def test_members_path_empty(self, renderer):
        assert renderer.members_path == ""
