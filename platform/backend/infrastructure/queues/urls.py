from django.urls import include, path
from rest_framework.routers import DefaultRouter

from infrastructure.queues.views import JobRecordViewSet

router = DefaultRouter()
router.register("admin/queues/jobs", JobRecordViewSet, basename="queue-job")

urlpatterns = [path("", include(router.urls))]

