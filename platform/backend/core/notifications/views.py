import csv
from datetime import datetime

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.models import AuditLog, Notification, SystemEvent
from core.notifications.permissions import ViewNotificationsPermission
from core.notifications.serializers import (
    AuditLogSerializer,
    NotificationSerializer,
    SystemEventSerializer,
)


class NotificationViewSet(SoftDeleteModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, ViewNotificationsPermission]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Notification.objects.all()
        return Notification.objects.filter(user=self.request.user)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, ViewNotificationsPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        action_code = self.request.query_params.get("action")
        entity = self.request.query_params.get("entity")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if q:
            queryset = queryset.filter(
                Q(action__icontains=q)
                | Q(entity__icontains=q)
                | Q(entity_id__icontains=q)
                | Q(actor__email__icontains=q)
            )
        if action_code:
            queryset = queryset.filter(action=action_code)
        if entity:
            queryset = queryset.filter(entity=entity)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="audit-logs-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "created_at",
                "actor_id",
                "action",
                "entity",
                "entity_id",
                "ip_address",
                "user_agent",
                "details",
            ]
        )
        for log in self.get_queryset():
            writer.writerow(
                [
                    log.id,
                    log.created_at,
                    log.actor_id or "",
                    log.action,
                    log.entity,
                    log.entity_id,
                    log.ip_address or "",
                    log.user_agent,
                    log.details,
                ]
            )
        return response


class SystemEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemEvent.objects.all()
    serializer_class = SystemEventSerializer
    permission_classes = [IsAuthenticated, ViewNotificationsPermission]
