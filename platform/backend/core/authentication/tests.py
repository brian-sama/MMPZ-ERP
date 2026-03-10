from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.authentication.throttles import LoginRateThrottle, PasswordResetRateThrottle, TokenRefreshRateThrottle
from core.authentication.views import LoginView, PasswordResetConfirmView, PasswordResetRequestView, RefreshView
from core.users.models import User


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="SecurePass123!",
        )

    def test_login_issues_tokens(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": "admin@example.com", "password": "SecurePass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_view_uses_login_throttle_scope_and_rate(self):
        self.assertIn(LoginRateThrottle, LoginView.throttle_classes)
        self.assertEqual(LoginRateThrottle.scope, "auth_login")
        self.assertIn("auth_login", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])

    def test_refresh_view_uses_refresh_throttle_scope_and_rate(self):
        self.assertIn(TokenRefreshRateThrottle, RefreshView.throttle_classes)
        self.assertEqual(TokenRefreshRateThrottle.scope, "auth_refresh")
        self.assertIn("auth_refresh", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])

    def test_password_reset_views_use_password_reset_throttle_scope_and_rate(self):
        self.assertIn(PasswordResetRateThrottle, PasswordResetRequestView.throttle_classes)
        self.assertIn(PasswordResetRateThrottle, PasswordResetConfirmView.throttle_classes)
        self.assertEqual(PasswordResetRateThrottle.scope, "auth_password_reset")
        self.assertIn("auth_password_reset", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])
