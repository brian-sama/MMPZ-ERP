import csv
from datetime import datetime

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from finance.models import Budget, Donation, Expense, FinancialReport, Transaction
from finance.permissions import ApproveFinancePermission
from finance.serializers import (
    BudgetSerializer,
    DonationSerializer,
    ExpenseSerializer,
    FinancialReportSerializer,
    TransactionSerializer,
)
from finance.services import (
    get_finance_summary_payload,
    record_donation_and_update_ledgers,
    record_expense_and_update_ledgers,
)
from infrastructure.cache.services import invalidate_cache_keys


class BudgetViewSet(SoftDeleteModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated, ApproveFinancePermission]

    def perform_create(self, serializer):
        budget = serializer.save()
        invalidate_cache_keys("dashboard:finance-summary", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="budget.created",
            entity="finance.budget",
            entity_id=str(budget.id),
            details={"name": budget.name},
        )

    def perform_update(self, serializer):
        budget = serializer.save()
        invalidate_cache_keys("dashboard:finance-summary", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="budget.updated",
            entity="finance.budget",
            entity_id=str(budget.id),
            details={"name": budget.name},
        )


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Transaction.objects.select_related("member", "budget").all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, ApproveFinancePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        member_id = self.request.query_params.get("member_id")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        status_filter = self.request.query_params.get("status")
        tx_type = self.request.query_params.get("type")

        if member_id:
            queryset = queryset.filter(member_id=member_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)
        if date_from:
            queryset = queryset.filter(transaction_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(transaction_date__lte=date_to)
        return queryset

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="transactions-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "transaction_type",
                "transaction_date",
                "amount",
                "status",
                "member_id",
                "budget_id",
                "reference",
                "description",
            ]
        )
        for tx in self.get_queryset():
            writer.writerow(
                [
                    tx.id,
                    tx.transaction_type,
                    tx.transaction_date,
                    tx.amount,
                    tx.status,
                    tx.member_id or "",
                    tx.budget_id or "",
                    tx.reference,
                    tx.description,
                ]
            )
        return response


class DonationViewSet(viewsets.ModelViewSet):
    queryset = Donation.objects.select_related("member", "transaction").all()
    serializer_class = DonationSerializer
    permission_classes = [IsAuthenticated, ApproveFinancePermission]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        donation, _txn = record_donation_and_update_ledgers(
            member=payload.get("member"),
            amount=payload["amount"],
            donated_on=payload["donated_on"],
            donor_name=payload.get("donor_name", ""),
            notes=payload.get("notes", ""),
        )
        create_audit_log(
            actor=request.user,
            action="donation.recorded",
            entity="finance.donation",
            entity_id=str(donation.id),
            details={"amount": str(donation.amount), "member_id": donation.member_id},
        )
        return Response(self.get_serializer(donation).data, status=status.HTTP_201_CREATED)


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("budget", "approved_by").all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, ApproveFinancePermission]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        expense = record_expense_and_update_ledgers(
            title=payload["title"],
            amount=payload["amount"],
            expense_date=payload["expense_date"],
            budget=payload.get("budget"),
            approved_by=payload.get("approved_by"),
            status=payload.get("status", "pending"),
            notes=payload.get("notes", ""),
        )
        create_audit_log(
            actor=request.user,
            action="expense.recorded",
            entity="finance.expense",
            entity_id=str(expense.id),
            details={"amount": str(expense.amount), "status": expense.status},
        )
        return Response(self.get_serializer(expense).data, status=status.HTTP_201_CREATED)


class FinancialReportViewSet(viewsets.ModelViewSet):
    queryset = FinancialReport.objects.select_related("generated_by").all()
    serializer_class = FinancialReportSerializer
    permission_classes = [IsAuthenticated, ApproveFinancePermission]


class FinanceSummaryView(APIView):
    permission_classes = [IsAuthenticated, ApproveFinancePermission]

    def get(self, request):
        return Response(get_finance_summary_payload())

