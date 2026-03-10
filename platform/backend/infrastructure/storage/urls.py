from django.urls import include, path
from rest_framework.routers import DefaultRouter

from infrastructure.storage.views import StoredFileViewSet

router = DefaultRouter()
router.register("admin/storage/files", StoredFileViewSet, basename="stored-file")

urlpatterns = [path("", include(router.urls))]

