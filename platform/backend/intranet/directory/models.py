from django.conf import settings
from django.db import models

from core.common.models import SoftDeleteModel


class DirectoryEntry(SoftDeleteModel):
    name = models.CharField(max_length=160)
    title = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_entries",
    )

    class Meta:
        db_table = "directories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class KnowledgeArticle(SoftDeleteModel):
    title = models.CharField(max_length=220)
    slug = models.SlugField(max_length=240, unique=True)
    content = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="knowledge_articles",
    )
    status = models.CharField(max_length=30, default="draft")
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "knowledge_articles"
        ordering = ["-created_at"]
