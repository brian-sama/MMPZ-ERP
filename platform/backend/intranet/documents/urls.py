from django.urls import include, path
from rest_framework.routers import DefaultRouter

from intranet.documents.views import DocumentVersionViewSet, DocumentViewSet

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("document-versions", DocumentVersionViewSet, basename="document-version")

urlpatterns = [path("", include(router.urls))]

