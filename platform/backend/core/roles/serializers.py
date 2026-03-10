from rest_framework import serializers

from core.roles.models import Role, UserRole


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = [
            "code",
            "name",
            "description",
            "is_executive",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class UserRoleSerializer(serializers.ModelSerializer):
    role_code = serializers.CharField(source="role.code", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserRole
        fields = [
            "id",
            "user",
            "role",
            "is_primary",
            "assigned_by",
            "user_email",
            "role_code",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "user_email", "role_code"]

