from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class Document(SoftDeleteModel):
    CATEGORY_CHOICES = (
        ("POLICIES", "Policies"),
        ("REPORTS", "Reports"),
        ("FORMS", "Forms"),
        ("MEETING_MINUTES", "Meeting Minutes"),
    )

    title = models.CharField(max_length=220)
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES)
    file_path = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    current_version = models.PositiveIntegerField(default=1)
    is_public = models.BooleanField(default=False)

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class DocumentVersion(TimestampedModel):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField()
    file_path = models.CharField(max_length=255)
    change_log = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_versions",
    )

    class Meta:
        db_table = "document_versions"
        unique_together = ("document", "version_number")
        ordering = ["-version_number"]
