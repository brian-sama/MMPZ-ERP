from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.permissions.models import Permission
from core.roles.models import Role, UserRole
from core.users.models import User
from membership.models import Member, MembershipCategory


class MembershipApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="staff@example.com",
            username="staff",
            password="SecurePass123!",
        )
        role = Role.objects.create(code="TEST_STAFF", name="Test Staff")
        UserRole.objects.create(user=self.user, role=role, is_primary=True)
        for code in ("members.view", "members.edit"):
            Permission.objects.get_or_create(code=code, defaults={"description": code})
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO role_permissions (role_code, permission_code, created_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (role_code, permission_code) DO NOTHING
                    """,
                    (role.code, code),
                )
        self.client.force_authenticate(user=self.user)

    def test_bulk_soft_delete_and_restore(self):
        category = MembershipCategory.objects.create(name="General")
        member = Member.objects.create(
            member_id="M-100",
            first_name="A",
            last_name="User",
            email="a@example.com",
            joined_on="2026-01-01",
            category=category,
        )

        delete_resp = self.client.post(
            reverse("member-bulk-soft-delete"),
            {"member_ids": [member.id]},
            format="json",
        )
        self.assertEqual(delete_resp.status_code, 200)
        member.refresh_from_db()
        self.assertIsNotNone(member.deleted_at)

        restore_resp = self.client.post(
            reverse("member-bulk-restore"),
            {"member_ids": [member.id]},
            format="json",
        )
        self.assertEqual(restore_resp.status_code, 200)
        member.refresh_from_db()
        self.assertIsNone(member.deleted_at)

    def test_member_export_csv(self):
        category = MembershipCategory.objects.create(name="Export Category")
        Member.objects.create(
            member_id="M-200",
            first_name="B",
            last_name="User",
            email="b@example.com",
            joined_on="2026-01-01",
            category=category,
        )

        response = self.client.get(reverse("member-export-csv"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn("M-200", response.content.decode("utf-8"))
