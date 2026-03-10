from django.urls import include, path
from rest_framework.routers import DefaultRouter

from intranet.events.views import EventViewSet

router = DefaultRouter()
router.register("events", EventViewSet, basename="event")

urlpatterns = [path("", include(router.urls))]

