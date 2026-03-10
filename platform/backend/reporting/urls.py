from django.urls import include, path
from rest_framework.routers import DefaultRouter

from reporting.views import DashboardMetricsView, ReportDefinitionViewSet, ReportRunViewSet

router = DefaultRouter()
router.register("reports/definitions", ReportDefinitionViewSet, basename="report-definition")
router.register("reports/runs", ReportRunViewSet, basename="report-run")

urlpatterns = [
    path("", include(router.urls)),
    path("reports/dashboard-metrics", DashboardMetricsView.as_view(), name="dashboard-metrics"),
]

