from rest_framework import serializers

from infrastructure.cache.models import CacheMetric


class CacheMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = CacheMetric
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

