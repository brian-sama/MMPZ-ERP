from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.users.views import UserViewSet, profile_view

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("", include(router.urls)),
    path("profile/", profile_view, name="profile"),
]

