from django.db.models import Count, F, Sum
from django.db import transaction
from rest_framework.exceptions import ValidationError

from inventory.models import InventoryItem, StockMovement
from infrastructure.cache.services import get_cached_or_compute, invalidate_cache_keys

INVENTORY_COUNTS_CACHE_KEY = "inventory:counts"


@transaction.atomic
def apply_stock_movement(movement: StockMovement) -> InventoryItem:
    item = movement.inventory_item
    if movement.movement_type == "in":
        item.quantity_on_hand += movement.quantity
    elif movement.movement_type == "out":
        if movement.quantity > item.quantity_on_hand:
            raise ValidationError(
                {
                    "quantity": (
                        f"Insufficient stock for {item.name}. "
                        f"Requested {movement.quantity}, available {item.quantity_on_hand}."
                    )
                }
            )
        item.quantity_on_hand -= movement.quantity
    else:
        item.quantity_on_hand = movement.quantity
    item.save(update_fields=["quantity_on_hand", "updated_at"])
    invalidate_cache_keys(INVENTORY_COUNTS_CACHE_KEY, "dashboard:metrics")
    return item


def get_inventory_counts_payload():
    def _compute():
        totals = InventoryItem.objects.aggregate(total_quantity=Sum("quantity_on_hand"), total_items=Count("id"))
        low_stock = InventoryItem.objects.filter(quantity_on_hand__lte=F("reorder_level")).count()
        return {
            "total_items": totals.get("total_items") or 0,
            "total_quantity": totals.get("total_quantity") or 0,
            "low_stock_count": low_stock,
        }

    return get_cached_or_compute(INVENTORY_COUNTS_CACHE_KEY, _compute, timeout=300)

