from django.urls import include, path
from rest_framework.routers import DefaultRouter

from inventory.views import (
    InventoryItemViewSet,
    PurchaseOrderViewSet,
    StockMovementViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("inventory", InventoryItemViewSet, basename="inventory-item")
router.register("inventory-suppliers", SupplierViewSet, basename="supplier")
router.register("inventory-stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("inventory-purchase-orders", PurchaseOrderViewSet, basename="purchase-order")

urlpatterns = [path("", include(router.urls))]

