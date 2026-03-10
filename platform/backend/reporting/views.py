from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reporting.models import ReportDefinition, ReportRun
from reporting.permissions import ViewReportsPermission
from reporting.serializers import ReportDefinitionSerializer, ReportRunSerializer
from reporting.services import get_dashboard_metrics_payload, queue_report_run


class ReportDefinitionViewSet(viewsets.ModelViewSet):
    queryset = ReportDefinition.objects.all()
    serializer_class = ReportDefinitionSerializer
    permission_classes = [IsAuthenticated, ViewReportsPermission]

    @action(detail=True, methods=["post"], url_path="run")
    def run_report(self, request, pk=None):
        report = self.get_object()
        run = queue_report_run(report, request.user)
        return Response(ReportRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)


class ReportRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReportRun.objects.select_related("report", "generated_by").all()
    serializer_class = ReportRunSerializer
    permission_classes = [IsAuthenticated, ViewReportsPermission]


class DashboardMetricsView(APIView):
    permission_classes = [IsAuthenticated, ViewReportsPermission]

    def get(self, request):
        return Response(get_dashboard_metrics_payload())

