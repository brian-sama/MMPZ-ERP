from decimal import Decimal

from assets.models import Asset, AssetDepreciation


def apply_depreciation_record(record: AssetDepreciation) -> Asset:
    asset = record.asset
    asset.current_value = max(Decimal("0"), asset.current_value - record.depreciation_amount)
    asset.save(update_fields=["current_value", "updated_at"])
    return asset

