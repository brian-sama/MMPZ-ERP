from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.permissions.models import Permission
from core.roles.models import Role, UserRole
from core.users.models import User


class UserAdminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.actor = User.objects.create_user(
            email="actor@example.com",
            username="actor",
            password="SecurePass123!",
        )
        self.target = User.objects.create_user(
            email="target@example.com",
            username="target",
            password="SecurePass123!",
        )

    def test_bulk_update_requires_members_edit_permission(self):
        self.client.force_authenticate(self.actor)
        response = self.client.post(
            reverse("user-bulk-update"),
            {"user_ids": [self.target.id], "is_suspended": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_bulk_update_with_members_edit_permission(self):
        role = Role.objects.create(code="TEST_USER_ADMIN", name="Test User Admin")
        UserRole.objects.create(user=self.actor, role=role, is_primary=True)
        Permission.objects.get_or_create(code="members.edit", defaults={"description": "members.edit"})
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role.code, "members.edit"),
            )

        self.client.force_authenticate(self.actor)
        response = self.client.post(
            reverse("user-bulk-update"),
            {"user_ids": [self.target.id], "is_suspended": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.is_suspended)
