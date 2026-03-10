from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from assets.models import Asset, AssetDepreciation, AssetLocation, AssetMaintenance
from assets.permissions import ManageAssetsPermission
from assets.serializers import (
    AssetDepreciationSerializer,
    AssetLocationSerializer,
    AssetMaintenanceSerializer,
    AssetSerializer,
)
from assets.services import apply_depreciation_record
from core.common.viewsets import SoftDeleteModelViewSet


class AssetLocationViewSet(SoftDeleteModelViewSet):
    queryset = AssetLocation.objects.all()
    serializer_class = AssetLocationSerializer
    permission_classes = [IsAuthenticated, ManageAssetsPermission]


class AssetViewSet(SoftDeleteModelViewSet):
    queryset = Asset.objects.select_related("location").all()
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated, ManageAssetsPermission]


class AssetMaintenanceViewSet(viewsets.ModelViewSet):
    queryset = AssetMaintenance.objects.select_related("asset").all()
    serializer_class = AssetMaintenanceSerializer
    permission_classes = [IsAuthenticated, ManageAssetsPermission]


class AssetDepreciationViewSet(viewsets.ModelViewSet):
    queryset = AssetDepreciation.objects.select_related("asset").all()
    serializer_class = AssetDepreciationSerializer
    permission_classes = [IsAuthenticated, ManageAssetsPermission]

    def perform_create(self, serializer):
        record = serializer.save()
        apply_depreciation_record(record)

