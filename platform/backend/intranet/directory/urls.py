from django.urls import include, path
from rest_framework.routers import DefaultRouter

from intranet.directory.views import DirectoryEntryViewSet, KnowledgeArticleViewSet

router = DefaultRouter()
router.register("directory", DirectoryEntryViewSet, basename="directory")
router.register("knowledge-base", KnowledgeArticleViewSet, basename="knowledge-article")

urlpatterns = [path("", include(router.urls))]

