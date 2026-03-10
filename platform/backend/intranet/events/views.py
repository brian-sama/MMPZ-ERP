from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from infrastructure.cache.services import invalidate_cache_keys
from intranet.events.models import Event
from intranet.events.permissions import ViewEventsPermission
from intranet.events.serializers import EventSerializer
from intranet.events.services import queue_event_reminder


class EventViewSet(SoftDeleteModelViewSet):
    queryset = Event.objects.select_related("created_by").all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated, ViewEventsPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        starts_from = self.request.query_params.get("starts_from")
        if q:
            queryset = queryset.filter(title__icontains=q)
        if starts_from:
            queryset = queryset.filter(starts_at__gte=starts_from)
        return queryset

    def perform_create(self, serializer):
        event = serializer.save(created_by=self.request.user)
        queue_event_reminder(event.id)
        invalidate_cache_keys("dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="event.created",
            entity="intranet.event",
            entity_id=str(event.id),
            details={"title": event.title},
        )

    def perform_update(self, serializer):
        event = serializer.save()
        invalidate_cache_keys("dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="event.updated",
            entity="intranet.event",
            entity_id=str(event.id),
            details={"title": event.title},
        )
