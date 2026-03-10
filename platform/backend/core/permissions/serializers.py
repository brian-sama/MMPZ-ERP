from rest_framework import serializers

from core.permissions.models import Permission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "code",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class RolePermissionSerializer(serializers.ModelSerializer):
    role_code = serializers.CharField()
    permission_code = serializers.CharField()
    created_at = serializers.DateTimeField(required=False)

