from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.permissions.models import Permission
from core.roles.models import Role, UserRole
from core.users.models import User
from intranet.documents.models import Document
from membership.models import Member, MembershipCategory


class CommandSearchApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="search@example.com",
            username="search",
            password="SecurePass123!",
        )
        role = Role.objects.create(code="TEST_SEARCH", name="Test Search")
        UserRole.objects.create(user=self.user, role=role, is_primary=True)
        Permission.objects.get_or_create(code="members.view", defaults={"description": "members.view"})
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role.code, "members.view"),
            )
        self.client.force_authenticate(self.user)

        category = MembershipCategory.objects.create(name="Search Category")
        Member.objects.create(
            member_id="M-SEARCH-1",
            first_name="Search",
            last_name="Member",
            email="member@example.com",
            joined_on="2026-01-01",
            category=category,
        )
        Document.objects.create(
            title="Search Policy",
            category="POLICIES",
            file_path="/uploads/documents/search-policy.pdf",
            uploaded_by=self.user,
        )

    def test_search_endpoint_returns_grouped_results(self):
        response = self.client.get(reverse("search-command"), {"q": "search"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("navigation", response.data)
        self.assertIn("members", response.data)
        self.assertIn("documents", response.data)
        self.assertGreaterEqual(len(response.data["members"]), 1)
