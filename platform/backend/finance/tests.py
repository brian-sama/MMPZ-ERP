from django.test import TestCase
from unittest.mock import patch

from finance.models import Budget, Donation
from finance.services import record_donation_and_update_ledgers, record_expense_and_update_ledgers
from membership.models import Member, MembershipCategory


class FinanceServiceTests(TestCase):
    def test_record_donation_updates_member_balance(self):
        category = MembershipCategory.objects.create(name="Standard")
        member = Member.objects.create(
            member_id="M-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            joined_on="2026-01-01",
            category=category,
        )

        donation, txn = record_donation_and_update_ledgers(
            member=member,
            amount="100.00",
            donated_on="2026-02-01",
            donor_name="John Doe",
            notes="Test donation",
        )
        member.refresh_from_db()

        self.assertEqual(str(donation.amount), "100.00")
        self.assertEqual(str(txn.amount), "100.00")
        self.assertEqual(str(member.balance), "100.00")

    def test_donation_flow_rolls_back_when_ledger_fails(self):
        category = MembershipCategory.objects.create(name="Rollback")
        member = Member.objects.create(
            member_id="M-002",
            first_name="Jane",
            last_name="Doe",
            email="jane@example.com",
            joined_on="2026-01-01",
            category=category,
        )

        with patch("finance.services.Transaction.objects.create", side_effect=RuntimeError("ledger failed")):
            with self.assertRaises(RuntimeError):
                record_donation_and_update_ledgers(
                    member=member,
                    amount="50.00",
                    donated_on="2026-02-15",
                    donor_name="Jane Doe",
                    notes="Rollback case",
                )

        member.refresh_from_db()
        self.assertEqual(Donation.objects.count(), 0)
        self.assertEqual(str(member.balance), "0.00")

    def test_expense_updates_budget_spent_when_approved(self):
        budget = Budget.objects.create(name="Ops", fiscal_year=2026, allocated_amount="1000.00")

        expense = record_expense_and_update_ledgers(
            title="Printer Ink",
            amount="125.00",
            expense_date="2026-02-10",
            budget=budget,
            status="approved",
            notes="Office supply",
        )
        budget.refresh_from_db()

        self.assertEqual(expense.title, "Printer Ink")
        self.assertEqual(str(budget.spent_amount), "125.00")

