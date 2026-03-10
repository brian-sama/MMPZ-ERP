from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class AssetLocation(SoftDeleteModel):
    name = models.CharField(max_length=180)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "asset_locations"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(SoftDeleteModel):
    asset_code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=100)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    current_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=30, default="active")
    location = models.ForeignKey(
        AssetLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )

    class Meta:
        db_table = "assets"
        ordering = ["name"]

    def __str__(self):
        return f"{self.asset_code} - {self.name}"


class AssetMaintenance(TimestampedModel):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="maintenance_records")
    maintenance_date = models.DateField()
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    next_due_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "asset_maintenance"
        ordering = ["-maintenance_date"]


class AssetDepreciation(TimestampedModel):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="depreciation_records")
    period_start = models.DateField()
    period_end = models.DateField()
    depreciation_amount = models.DecimalField(max_digits=14, decimal_places=2)
    book_value = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "asset_depreciation"
        ordering = ["-period_end"]

