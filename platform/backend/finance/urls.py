from django.urls import include, path
from rest_framework.routers import DefaultRouter

from finance.views import (
    BudgetViewSet,
    DonationViewSet,
    ExpenseViewSet,
    FinanceSummaryView,
    FinancialReportViewSet,
    TransactionViewSet,
)

router = DefaultRouter()
router.register("finance-budgets", BudgetViewSet, basename="budget")
router.register("finance-transactions", TransactionViewSet, basename="transaction")
router.register("finance-donations", DonationViewSet, basename="donation")
router.register("finance-expenses", ExpenseViewSet, basename="expense")
router.register("finance-reports", FinancialReportViewSet, basename="financial-report")

urlpatterns = [
    path("finance/", FinanceSummaryView.as_view(), name="finance-summary"),
    path("", include(router.urls)),
]

