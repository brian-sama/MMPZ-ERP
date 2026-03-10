from rest_framework import serializers

from assets.models import Asset, AssetDepreciation, AssetLocation, AssetMaintenance


class AssetLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetLocation
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class AssetMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetMaintenance
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class AssetDepreciationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetDepreciation
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

