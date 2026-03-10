from django.db import models

from core.common.models import TimestampedModel


class Permission(TimestampedModel):
    code = models.CharField(max_length=120, primary_key=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "permissions"
        ordering = ["code"]

    def __str__(self):
        return self.code
