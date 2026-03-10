from pathlib import Path
import uuid

from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from infrastructure.storage.services import ensure_upload_directory
from intranet.documents.models import Document, DocumentVersion
from intranet.documents.permissions import UploadDocumentsPermission
from intranet.documents.serializers import DocumentSerializer, DocumentVersionSerializer
from intranet.documents.services import create_document_version


class DocumentViewSet(SoftDeleteModelViewSet):
    queryset = Document.objects.select_related("uploaded_by").all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, UploadDocumentsPermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        if q:
            queryset = queryset.filter(title__icontains=q)
        if category:
            queryset = queryset.filter(category=category)
        return queryset

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        create_audit_log(
            actor=self.request.user,
            action="document.uploaded",
            entity="intranet.document",
            entity_id=str(document.id),
            details={"category": document.category, "title": document.title},
        )

    @action(detail=True, methods=["post"], url_path="versions")
    def add_version(self, request, pk=None):
        document = self.get_object()
        uploaded_file = request.FILES.get("file")
        file_path = request.data.get("file_path")

        if uploaded_file:
            documents_dir = ensure_upload_directory("documents")
            safe_name = f"{uuid.uuid4().hex}_{uploaded_file.name}"
            destination = documents_dir / safe_name
            with destination.open("wb+") as handle:
                for chunk in uploaded_file.chunks():
                    handle.write(chunk)
            relative_file_path = str(Path("documents") / safe_name).replace("\\", "/")
            file_path = f"{settings.MEDIA_URL}{relative_file_path}".replace("//", "/")

        if not file_path:
            return Response(
                {"detail": "file or file_path is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        version = create_document_version(
            document,
            file_path=file_path,
            uploaded_by=request.user,
            change_log=request.data.get("change_log", ""),
        )
        create_audit_log(
            actor=request.user,
            action="document.version_added",
            entity="intranet.document",
            entity_id=str(document.id),
            details={"version_number": version.version_number},
        )
        return Response(DocumentVersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        document = self.get_object()
        versions = document.versions.order_by("-version_number")[:5]
        return Response(
            {
                "id": document.id,
                "title": document.title,
                "category": document.category,
                "file_path": document.file_path,
                "current_version": document.current_version,
                "versions": DocumentVersionSerializer(versions, many=True).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="upload-file")
    def upload_file(self, request):
        uploaded_file = request.FILES.get("file")
        title = request.data.get("title")
        category = request.data.get("category")
        if not uploaded_file or not title or not category:
            return Response(
                {"detail": "file, title, and category are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        documents_dir = ensure_upload_directory("documents")
        safe_name = f"{uuid.uuid4().hex}_{uploaded_file.name}"
        destination = documents_dir / safe_name
        with destination.open("wb+") as handle:
            for chunk in uploaded_file.chunks():
                handle.write(chunk)

        relative_file_path = str(Path("documents") / safe_name).replace("\\", "/")
        public_file_path = f"{settings.MEDIA_URL}{relative_file_path}".replace("//", "/")

        document = Document.objects.create(
            title=title,
            category=category,
            file_path=public_file_path,
            uploaded_by=request.user,
            is_public=request.data.get("is_public") in {"1", "true", "True"},
            current_version=1,
        )
        DocumentVersion.objects.create(
            document=document,
            version_number=1,
            file_path=public_file_path,
            change_log=request.data.get("change_log", "Initial upload"),
            uploaded_by=request.user,
        )
        create_audit_log(
            actor=request.user,
            action="document.file_uploaded",
            entity="intranet.document",
            entity_id=str(document.id),
            details={"title": document.title, "file_path": document.file_path},
        )
        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class DocumentVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DocumentVersion.objects.select_related("document", "uploaded_by").all()
    serializer_class = DocumentVersionSerializer
    permission_classes = [IsAuthenticated, UploadDocumentsPermission]
