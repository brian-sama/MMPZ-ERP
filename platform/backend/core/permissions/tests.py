from django.test import TestCase

from django.db import connection

from core.permissions.models import Permission
from core.permissions.services import user_has_permission
from core.roles.models import Role, UserRole
from core.users.models import User


class PermissionServiceTests(TestCase):
    def test_user_inherits_permission_from_role(self):
        user = User.objects.create_user(email="user@example.com", username="user", password="pass12345")
        role = Role.objects.create(code="STAFF", name="Staff")
        perm = Permission.objects.create(code="members.view", description="Can view members")
        UserRole.objects.create(user=user, role=role, is_primary=True)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role.code, perm.code),
            )

        self.assertTrue(user_has_permission(user, "members.view"))

# Create your tests here.
