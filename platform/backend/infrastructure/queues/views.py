from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from infrastructure.queues.models import JobRecord
from infrastructure.queues.permissions import ManageQueuePermission
from infrastructure.queues.serializers import JobRecordSerializer
from infrastructure.queues.services import queue_email, queue_export, queue_notification, queue_report, retry_job


class JobRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JobRecord.objects.all()
    serializer_class = JobRecordSerializer
    permission_classes = [IsAuthenticated, ManageQueuePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        task_name = self.request.query_params.get("task_name")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if task_name:
            queryset = queryset.filter(task_name=task_name)
        return queryset

    @action(detail=False, methods=["post"], url_path="email")
    def queue_email_job(self, request):
        job, task = queue_email(request.data)
        return Response(
            {"task_id": str(task.id), "job": JobRecordSerializer(job).data},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"], url_path="report")
    def queue_report_job(self, request):
        job, task = queue_report(request.data)
        return Response(
            {"task_id": str(task.id), "job": JobRecordSerializer(job).data},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"], url_path="notification")
    def queue_notification_job(self, request):
        job, task = queue_notification(request.data)
        return Response(
            {"task_id": str(task.id), "job": JobRecordSerializer(job).data},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"], url_path="export")
    def queue_export_job(self, request):
        job, task = queue_export(request.data)
        return Response(
            {"task_id": str(task.id), "job": JobRecordSerializer(job).data},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="retry")
    def retry_failed_job(self, request, pk=None):
        job = self.get_object()
        task = retry_job(job)
        job.refresh_from_db()
        if task is None:
            return Response(
                {"detail": "Job cannot be retried", "job": JobRecordSerializer(job).data},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"task_id": str(task.id), "job": JobRecordSerializer(job).data},
            status=status.HTTP_202_ACCEPTED,
        )
