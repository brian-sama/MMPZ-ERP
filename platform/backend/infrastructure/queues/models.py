from django.db import models

from core.common.models import TimestampedModel


class JobRecord(TimestampedModel):
    task_name = models.CharField(max_length=180)
    status = models.CharField(max_length=30, default="queued")
    payload = models.JSONField(default=dict, blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "queue_jobs"
        ordering = ["-created_at"]
