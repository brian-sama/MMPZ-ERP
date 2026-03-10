from django.urls import include, path
from rest_framework.routers import DefaultRouter

from membership.views import (
    AttendanceViewSet,
    ContributionViewSet,
    MemberViewSet,
    MembershipCategoryViewSet,
)

router = DefaultRouter()
router.register("members", MemberViewSet, basename="member")
router.register("membership-categories", MembershipCategoryViewSet, basename="membership-category")
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("contributions", ContributionViewSet, basename="contribution")

urlpatterns = [path("", include(router.urls))]

