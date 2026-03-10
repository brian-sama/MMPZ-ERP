from django.test import TestCase
from django.db import connection
from django.urls import reverse
from rest_framework.test import APIClient

from core.permissions.models import Permission
from core.roles.models import Role, UserRole
from core.users.models import User
from finance.models import Donation, Expense
from inventory.models import InventoryItem
from membership.models import Member, MembershipCategory


class DashboardMetricsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="reporter@example.com",
            username="reporter",
            password="SecurePass123!",
        )
        role = Role.objects.create(code="TEST_REPORTER", name="Test Reporter")
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
        self.client.force_authenticate(user=self.user)

    def test_dashboard_metrics_endpoint_returns_expected_sections(self):
        category = MembershipCategory.objects.create(name="Metrics")
        member = Member.objects.create(
            member_id="M-500",
            first_name="Metric",
            last_name="User",
            email="metric@example.com",
            joined_on="2026-02-01",
            category=category,
        )
        Donation.objects.create(member=member, donor_name="Metric User", amount="75.00", donated_on="2026-02-02")
        Expense.objects.create(title="Ops", amount="25.00", expense_date="2026-02-03", status="approved")
        InventoryItem.objects.create(name="Paper", sku="PAPER-1", quantity_on_hand=2, reorder_level=5)

        response = self.client.get(reverse("dashboard-metrics"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("members_total", response.data)
        self.assertIn("donations_total", response.data)
        self.assertIn("expenses_total", response.data)
        self.assertIn("low_stock_count", response.data)
