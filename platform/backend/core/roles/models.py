from django.conf import settings
from django.db import models

from core.common.models import TimestampedModel


class Role(models.Model):
    code = models.CharField(max_length=80, primary_key=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_executive = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "roles"
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserRole(TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_assignments",
        to_field="code",
        db_column="role_code",
    )
    is_primary = models.BooleanField(default=False)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_roles",
    )

    class Meta:
        db_table = "user_roles"
        unique_together = ("user", "role")
        indexes = [models.Index(fields=["user"]), models.Index(fields=["role"])]

    def __str__(self):
        return f"{self.user_id}:{self.role_id}"
