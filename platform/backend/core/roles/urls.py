from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.roles.views import RoleViewSet, UserRoleViewSet

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("user-roles", UserRoleViewSet, basename="user-role")

urlpatterns = [
    path("", include(router.urls)),
]

