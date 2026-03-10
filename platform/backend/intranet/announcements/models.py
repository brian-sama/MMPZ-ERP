from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel


class Announcement(SoftDeleteModel):
    title = models.CharField(max_length=200)
    content = models.TextField()
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements",
    )

    class Meta:
        db_table = "announcements"
        ordering = ["-is_pinned", "-created_at"]

    def __str__(self):
        return self.title
