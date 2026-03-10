from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class MessageChannel(SoftDeleteModel):
    CHANNEL_TYPE_CHOICES = (
        ("DIRECT", "Direct"),
        ("DEPARTMENT", "Department"),
    )

    name = models.CharField(max_length=120)
    channel_type = models.CharField(max_length=20, choices=CHANNEL_TYPE_CHOICES, default="DEPARTMENT")
    department = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_channels",
    )

    class Meta:
        db_table = "message_channels"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Message(TimestampedModel):
    channel = models.ForeignKey(MessageChannel, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages_sent",
    )
    content = models.TextField()
    attachment_path = models.CharField(max_length=255, blank=True)
    is_system_message = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "messages"
        ordering = ["-created_at"]
