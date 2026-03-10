import shutil
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from core.permissions.models import Permission
from core.roles.models import Role, UserRole
from core.users.models import User
from intranet.documents.models import Document


TEST_MEDIA_ROOT = Path(__file__).resolve().parent / "test_media"


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, MEDIA_URL="/uploads/")
class DocumentApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="docs@example.com",
            username="docs-user",
            password="SecurePass123!",
        )
        role = Role.objects.create(code="TEST_DOCS", name="Test Docs")
        UserRole.objects.create(user=self.user, role=role, is_primary=True)
        Permission.objects.get_or_create(code="documents.upload", defaults={"description": "documents.upload"})
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role.code, "documents.upload"),
            )
        self.client.force_authenticate(self.user)

    def tearDown(self):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def test_add_version_requires_file_path(self):
        document = Document.objects.create(
            title="Policy A",
            category="POLICIES",
            file_path="/uploads/documents/policy-a.pdf",
            uploaded_by=self.user,
        )
        response = self.client.post(reverse("document-add-version", kwargs={"pk": document.id}), {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_add_version_accepts_uploaded_file(self):
        document = Document.objects.create(
            title="Policy Upload",
            category="POLICIES",
            file_path="/uploads/documents/policy-upload-v1.txt",
            uploaded_by=self.user,
        )
        response = self.client.post(
            reverse("document-add-version", kwargs={"pk": document.id}),
            {"file": SimpleUploadedFile("policy-upload-v2.txt", b"version-2", content_type="text/plain")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        document.refresh_from_db()
        self.assertEqual(document.current_version, 2)
        self.assertTrue(document.file_path.startswith("/uploads/documents/"))
        self.assertTrue(Path(settings.MEDIA_ROOT, "documents").exists())

    def test_preview_returns_recent_versions(self):
        document = Document.objects.create(
            title="Policy B",
            category="POLICIES",
            file_path="/uploads/documents/policy-b.pdf",
            uploaded_by=self.user,
        )
        add_version_response = self.client.post(
            reverse("document-add-version", kwargs={"pk": document.id}),
            {"file_path": "/uploads/documents/policy-b-v2.pdf", "change_log": "v2"},
            format="json",
        )
        self.assertEqual(add_version_response.status_code, 201)

        preview_response = self.client.get(reverse("document-preview", kwargs={"pk": document.id}))
        self.assertEqual(preview_response.status_code, 200)
        self.assertIn("versions", preview_response.data)
        self.assertGreaterEqual(len(preview_response.data["versions"]), 1)
