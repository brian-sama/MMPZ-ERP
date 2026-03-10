from django.db import models

from core.common.models import TimestampedModel


class EmailIntegration(TimestampedModel):
    smtp_host = models.CharField(max_length=120)
    smtp_port = models.PositiveIntegerField(default=587)
    username = models.CharField(max_length=120, blank=True)
    from_email = models.EmailField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "integration_email"
