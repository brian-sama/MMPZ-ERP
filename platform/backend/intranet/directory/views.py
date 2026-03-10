from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.common.viewsets import SoftDeleteModelViewSet
from intranet.directory.models import DirectoryEntry, KnowledgeArticle
from intranet.directory.permissions import ViewDirectoryPermission
from intranet.directory.serializers import DirectoryEntrySerializer, KnowledgeArticleSerializer


class DirectoryEntryViewSet(SoftDeleteModelViewSet):
    queryset = DirectoryEntry.objects.select_related("user").all()
    serializer_class = DirectoryEntrySerializer
    permission_classes = [IsAuthenticated, ViewDirectoryPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(name__icontains=q)
        return queryset


class KnowledgeArticleViewSet(SoftDeleteModelViewSet):
    queryset = KnowledgeArticle.objects.select_related("author").all()
    serializer_class = KnowledgeArticleSerializer
    permission_classes = [IsAuthenticated, ViewDirectoryPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        status_filter = self.request.query_params.get("status")
        if q:
            queryset = queryset.filter(title__icontains=q)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
