from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from infrastructure.cache.services import invalidate_cache_keys
from intranet.announcements.models import Announcement
from intranet.announcements.permissions import ViewAnnouncementsPermission
from intranet.announcements.serializers import AnnouncementSerializer
from intranet.announcements.services import log_announcement_published


class AnnouncementViewSet(SoftDeleteModelViewSet):
    queryset = Announcement.objects.select_related("created_by").all()
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, ViewAnnouncementsPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(title__icontains=q)
        return queryset

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        log_announcement_published(announcement.title)
        invalidate_cache_keys("dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="announcement.created",
            entity="intranet.announcement",
            entity_id=str(announcement.id),
            details={"title": announcement.title},
        )

    def perform_update(self, serializer):
        announcement = serializer.save()
        invalidate_cache_keys("dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="announcement.updated",
            entity="intranet.announcement",
            entity_id=str(announcement.id),
            details={"title": announcement.title},
        )
