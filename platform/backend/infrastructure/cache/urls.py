from django.urls import include, path
from rest_framework.routers import DefaultRouter

from infrastructure.cache.views import CacheMetricViewSet

router = DefaultRouter()
router.register("admin/cache", CacheMetricViewSet, basename="cache-metric")

urlpatterns = [path("", include(router.urls))]

