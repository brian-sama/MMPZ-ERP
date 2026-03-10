from collections.abc import Callable

from django.core.cache import cache
from django.utils import timezone

from infrastructure.cache.models import CacheMetric


def record_cache_hit(cache_key: str):
    metric, _ = CacheMetric.objects.get_or_create(cache_key=cache_key)
    metric.hit_count += 1
    metric.last_hit_at = timezone.now()
    metric.save(update_fields=["hit_count", "last_hit_at", "updated_at"])


def record_cache_miss(cache_key: str):
    metric, _ = CacheMetric.objects.get_or_create(cache_key=cache_key)
    metric.miss_count += 1
    metric.last_miss_at = timezone.now()
    metric.save(update_fields=["miss_count", "last_miss_at", "updated_at"])


def get_cached_or_compute(cache_key: str, compute: Callable[[], dict], timeout: int = 300):
    cached = cache.get(cache_key)
    if cached is not None:
        record_cache_hit(cache_key)
        return cached

    record_cache_miss(cache_key)
    payload = compute()
    cache.set(cache_key, payload, timeout=timeout)
    return payload


def invalidate_cache_keys(*cache_keys: str) -> int:
    removed = 0
    for cache_key in cache_keys:
        if not cache_key:
            continue
        cache.delete(cache_key)
        removed += 1
    return removed


def invalidate_cache_prefixes(*prefixes: str) -> int:
    removed = 0
    for prefix in prefixes:
        if not prefix:
            continue
        keys = CacheMetric.objects.filter(cache_key__startswith=prefix).values_list("cache_key", flat=True)
        for cache_key in keys:
            cache.delete(cache_key)
            removed += 1
    return removed

