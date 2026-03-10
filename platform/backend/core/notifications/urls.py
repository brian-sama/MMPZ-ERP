from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.notifications.views import AuditLogViewSet, NotificationViewSet, SystemEventViewSet

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
router.register("system-events", SystemEventViewSet, basename="system-event")

urlpatterns = [
    path("", include(router.urls)),
]

