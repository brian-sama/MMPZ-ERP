from django.urls import include, path
from rest_framework.routers import DefaultRouter

from intranet.announcements.views import AnnouncementViewSet

router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="announcement")

urlpatterns = [path("", include(router.urls))]

