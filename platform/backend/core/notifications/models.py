from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class Notification(SoftDeleteModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=180)
    message = models.TextField()
    type = models.CharField(max_length=50, default="info")
    is_read = models.BooleanField(default=False)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id}:{self.title}"


class AuditLog(TimestampedModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
    )
    action = models.CharField(max_length=120)
    entity = models.CharField(max_length=120)
    entity_id = models.CharField(max_length=120, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity"]), models.Index(fields=["created_at"])]

    def __str__(self):
        return f"{self.action}:{self.entity}:{self.entity_id}"


class SystemEvent(TimestampedModel):
    event_type = models.CharField(max_length=120)
    level = models.CharField(max_length=20, default="info")
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "system_events"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.level}:{self.event_type}"
