from decimal import Decimal

from django.db.models import Sum
from django.db import transaction

from finance.models import Budget, Donation, Expense, Transaction
from infrastructure.cache.services import get_cached_or_compute, invalidate_cache_keys
from membership.models import Member

FINANCE_SUMMARY_CACHE_KEY = "dashboard:finance-summary"


@transaction.atomic
def record_donation_and_update_ledgers(*, member: Member | None, amount, donated_on, donor_name="", notes=""):
    amount_value = Decimal(str(amount))
    donation = Donation.objects.create(
        member=member,
        donor_name=donor_name,
        amount=amount_value,
        donated_on=donated_on,
        notes=notes,
    )
    ledger_txn = Transaction.objects.create(
        transaction_type="donation",
        amount=amount_value,
        transaction_date=donated_on,
        member=member,
        description=f"Donation from {donor_name or 'member'}",
        status="posted",
    )
    donation.transaction = ledger_txn
    donation.save(update_fields=["transaction"])

    if member:
        member.balance = Decimal(member.balance or 0) + amount_value
        member.save(update_fields=["balance", "updated_at"])

    invalidate_cache_keys(FINANCE_SUMMARY_CACHE_KEY, "dashboard:metrics")
    return donation, ledger_txn


@transaction.atomic
def record_expense_and_update_ledgers(
    *,
    title: str,
    amount,
    expense_date,
    budget: Budget | None = None,
    approved_by=None,
    status: str = "pending",
    notes: str = "",
):
    amount_value = Decimal(str(amount))
    expense = Expense.objects.create(
        title=title,
        amount=amount_value,
        expense_date=expense_date,
        budget=budget,
        approved_by=approved_by,
        status=status,
        notes=notes,
    )

    Transaction.objects.create(
        transaction_type="expense",
        amount=amount_value,
        transaction_date=expense_date,
        budget=budget,
        reference=f"EXP-{expense.id}",
        description=title,
        status="posted" if status == "approved" else "pending",
    )

    if budget and status == "approved":
        budget.spent_amount = Decimal(budget.spent_amount or 0) + amount_value
        budget.save(update_fields=["spent_amount", "updated_at"])

    invalidate_cache_keys(FINANCE_SUMMARY_CACHE_KEY, "dashboard:metrics")
    return expense


def get_finance_summary_payload():
    def _compute():
        donations_total = Donation.objects.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        expenses_total = Expense.objects.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        return {
            "donations_total": donations_total,
            "expenses_total": expenses_total,
            "net": donations_total - expenses_total,
        }

    return get_cached_or_compute(FINANCE_SUMMARY_CACHE_KEY, _compute, timeout=300)

