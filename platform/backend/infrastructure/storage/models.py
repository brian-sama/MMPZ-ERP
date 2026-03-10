from django.conf import settings
from django.db import models

from core.common.models import TimestampedModel


class StoredFile(TimestampedModel):
    module = models.CharField(max_length=80)
    file_path = models.CharField(max_length=255)
    file_name = models.CharField(max_length=180)
    file_type = models.CharField(max_length=80, blank=True)
    file_size = models.BigIntegerField(default=0)
    checksum = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stored_files",
    )

    class Meta:
        db_table = "stored_files"
        ordering = ["-created_at"]
