from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.permissions.views import PermissionViewSet, RolePermissionViewSet

router = DefaultRouter()
router.register("permissions", PermissionViewSet, basename="permission")
router.register("role-permissions", RolePermissionViewSet, basename="role-permission")

urlpatterns = [
    path("", include(router.urls)),
]

