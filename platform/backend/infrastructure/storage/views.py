from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from infrastructure.storage.models import StoredFile
from infrastructure.storage.permissions import ManageStoragePermission
from infrastructure.storage.serializers import StoredFileSerializer


class StoredFileViewSet(viewsets.ModelViewSet):
    queryset = StoredFile.objects.select_related("uploaded_by").all()
    serializer_class = StoredFileSerializer
    permission_classes = [IsAuthenticated, ManageStoragePermission]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
