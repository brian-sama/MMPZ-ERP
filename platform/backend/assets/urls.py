from django.urls import include, path
from rest_framework.routers import DefaultRouter

from assets.views import (
    AssetDepreciationViewSet,
    AssetLocationViewSet,
    AssetMaintenanceViewSet,
    AssetViewSet,
)

router = DefaultRouter()
router.register("assets", AssetViewSet, basename="asset")
router.register("asset-locations", AssetLocationViewSet, basename="asset-location")
router.register("asset-maintenance", AssetMaintenanceViewSet, basename="asset-maintenance")
router.register("asset-depreciation", AssetDepreciationViewSet, basename="asset-depreciation")

urlpatterns = [path("", include(router.urls))]

