from django.core.cache import cache
from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from infrastructure.cache.models import CacheMetric
from infrastructure.cache.permissions import ViewCachePermission
from infrastructure.cache.serializers import CacheMetricSerializer
from infrastructure.cache.services import invalidate_cache_prefixes


class CacheMetricViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CacheMetric.objects.all()
    serializer_class = CacheMetricSerializer
    permission_classes = [IsAuthenticated, ViewCachePermission]

    @action(detail=False, methods=["post"], url_path="clear")
    def clear_cache(self, request):
        cache.clear()
        return Response({"detail": "Cache cleared"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="invalidate-prefix")
    def invalidate_prefix(self, request):
        prefixes = request.data.get("prefixes") or []
        if not isinstance(prefixes, list):
            return Response({"detail": "prefixes must be a list"}, status=status.HTTP_400_BAD_REQUEST)
        removed = invalidate_cache_prefixes(*prefixes)
        return Response({"detail": "Cache keys invalidated", "removed": removed}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        totals = CacheMetric.objects.aggregate(total_hits=Sum("hit_count"), total_misses=Sum("miss_count"))
        hit_count = totals.get("total_hits") or 0
        miss_count = totals.get("total_misses") or 0
        denominator = hit_count + miss_count
        hit_ratio = round((hit_count / denominator) * 100, 2) if denominator else 0
        return Response(
            {
                "hit_count": hit_count,
                "miss_count": miss_count,
                "hit_ratio_percent": hit_ratio,
                "tracked_keys": CacheMetric.objects.count(),
            }
        )
