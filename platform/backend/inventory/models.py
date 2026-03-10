from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class Supplier(SoftDeleteModel):
    name = models.CharField(max_length=180)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)

    class Meta:
        db_table = "suppliers"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InventoryItem(SoftDeleteModel):
    name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    quantity_on_hand = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_items",
    )

    class Meta:
        db_table = "inventory_items"
        ordering = ["name"]
        indexes = [models.Index(fields=["id"])]


class StockMovement(TimestampedModel):
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        db_index=True,
    )
    movement_type = models.CharField(max_length=30)
    quantity = models.IntegerField()
    movement_date = models.DateField()
    reference = models.CharField(max_length=120, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "stock_movements"
        ordering = ["-movement_date", "-created_at"]
        indexes = [models.Index(fields=["inventory_item"])]


class PurchaseOrder(TimestampedModel):
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    order_number = models.CharField(max_length=60, unique=True)
    order_date = models.DateField()
    expected_delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default="draft")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = "purchase_orders"
        ordering = ["-order_date"]

