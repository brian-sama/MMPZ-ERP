from django.conf import settings
from django.db import models

from core.common.models import TimestampedModel


class ReportDefinition(TimestampedModel):
    key = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=180)
    module = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "report_definitions"
        ordering = ["module", "name"]

    def __str__(self):
        return self.name


class ReportRun(TimestampedModel):
    report = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name="runs")
    status = models.CharField(max_length=30, default="queued")
    output_path = models.CharField(max_length=255, blank=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_runs",
    )
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "report_runs"
        ordering = ["-created_at"]

