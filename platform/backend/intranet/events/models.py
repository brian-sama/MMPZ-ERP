from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel


class Event(SoftDeleteModel):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_created",
    )

    class Meta:
        db_table = "events"
        ordering = ["starts_at"]

    def __str__(self):
        return self.title
