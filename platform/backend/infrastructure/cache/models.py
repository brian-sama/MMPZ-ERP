from django.db import models

from core.common.models import TimestampedModel


class CacheMetric(TimestampedModel):
    cache_key = models.CharField(max_length=255, unique=True)
    hit_count = models.PositiveIntegerField(default=0)
    miss_count = models.PositiveIntegerField(default=0)
    last_hit_at = models.DateTimeField(null=True, blank=True)
    last_miss_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "cache_metrics"
        ordering = ["-updated_at"]
