import csv
from datetime import datetime

from django.db.models import F, Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from inventory.models import InventoryItem, PurchaseOrder, StockMovement, Supplier
from inventory.permissions import ManageInventoryPermission
from inventory.serializers import (
    InventoryItemSerializer,
    PurchaseOrderSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)
from infrastructure.cache.services import invalidate_cache_keys
from inventory.services import apply_stock_movement, get_inventory_counts_payload


class SupplierViewSet(SoftDeleteModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, ManageInventoryPermission]


class InventoryItemViewSet(SoftDeleteModelViewSet):
    queryset = InventoryItem.objects.select_related("supplier").all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated, ManageInventoryPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        low_stock = self.request.query_params.get("low_stock")
        supplier_id = self.request.query_params.get("supplier_id")

        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(sku__icontains=q))
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        if low_stock in {"1", "true", "True"}:
            queryset = queryset.filter(quantity_on_hand__lte=F("reorder_level"))
        return queryset

    def perform_create(self, serializer):
        item = serializer.save()
        invalidate_cache_keys("inventory:counts", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="inventory.item_created",
            entity="inventory.item",
            entity_id=str(item.id),
            details={"sku": item.sku},
        )

    def perform_update(self, serializer):
        item = serializer.save()
        invalidate_cache_keys("inventory:counts", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="inventory.item_updated",
            entity="inventory.item",
            entity_id=str(item.id),
            details={"sku": item.sku},
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        return Response(get_inventory_counts_payload())

    @action(detail=False, methods=["post"], url_path="bulk-update-reorder-level")
    def bulk_update_reorder_level(self, request):
        item_ids = request.data.get("item_ids") or []
        reorder_level = request.data.get("reorder_level")
        if not item_ids or reorder_level is None:
            return Response(
                {"detail": "item_ids and reorder_level are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = InventoryItem.objects.filter(id__in=item_ids).update(reorder_level=reorder_level)
        invalidate_cache_keys("inventory:counts", "dashboard:metrics")
        create_audit_log(
            actor=request.user,
            action="inventory.bulk_reorder_update",
            entity="inventory.item",
            details={"item_count": updated, "reorder_level": reorder_level},
        )
        return Response({"updated": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="inventory-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "name",
                "sku",
                "quantity_on_hand",
                "reorder_level",
                "unit_cost",
                "supplier_id",
                "deleted_at",
            ]
        )
        for item in self.get_queryset():
            writer.writerow(
                [
                    item.id,
                    item.name,
                    item.sku,
                    item.quantity_on_hand,
                    item.reorder_level,
                    item.unit_cost,
                    item.supplier_id or "",
                    item.deleted_at or "",
                ]
            )
        return response


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("inventory_item", "performed_by").all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, ManageInventoryPermission]

    def perform_create(self, serializer):
        movement = serializer.save(performed_by=self.request.user)
        apply_stock_movement(movement)
        create_audit_log(
            actor=self.request.user,
            action="inventory.stock_movement",
            entity="inventory.stock_movement",
            entity_id=str(movement.id),
            details={
                "inventory_item_id": movement.inventory_item_id,
                "movement_type": movement.movement_type,
                "quantity": movement.quantity,
            },
        )


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier").all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, ManageInventoryPermission]

