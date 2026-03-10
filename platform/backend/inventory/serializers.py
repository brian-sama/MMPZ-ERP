from rest_framework import serializers

from inventory.models import InventoryItem, PurchaseOrder, StockMovement, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "performed_by"]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Movement quantity must be greater than zero.")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

