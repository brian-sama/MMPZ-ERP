from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel
from membership.models import Member


class Budget(SoftDeleteModel):
    name = models.CharField(max_length=150)
    fiscal_year = models.IntegerField()
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2)
    spent_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=30, default="active")

    class Meta:
        db_table = "budgets"
        ordering = ["-fiscal_year", "name"]


class Transaction(TimestampedModel):
    transaction_type = models.CharField(max_length=40)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    transaction_date = models.DateField(db_index=True)
    member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    budget = models.ForeignKey(
        Budget,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    reference = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=30, default="posted")

    class Meta:
        db_table = "transactions"
        ordering = ["-transaction_date", "-created_at"]
        indexes = [models.Index(fields=["transaction_date"])]


class Donation(TimestampedModel):
    member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donations",
    )
    donor_name = models.CharField(max_length=180, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    donated_on = models.DateField()
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donation",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "donations"
        ordering = ["-donated_on"]


class Expense(TimestampedModel):
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    expense_date = models.DateField()
    status = models.CharField(max_length=30, default="pending")
    budget = models.ForeignKey(
        Budget,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_expenses",
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "expenses"
        ordering = ["-expense_date"]


class FinancialReport(TimestampedModel):
    report_type = models.CharField(max_length=80)
    period_start = models.DateField()
    period_end = models.DateField()
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="financial_reports",
    )
    file_path = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "financial_reports"
        ordering = ["-created_at"]

