from django.conf import settings
from django.db import models

from core.common.models import TimestampedModel


class AuthSession(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="auth_sessions",
    )
    session_key = models.CharField(max_length=80, unique=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_revoked = models.BooleanField(default=False)

    class Meta:
        db_table = "auth_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id}:{self.session_key}"
