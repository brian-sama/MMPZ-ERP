from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.roles.models import UserRole

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "bio",
            "must_reset_password",
            "is_suspended",
            "roles",
            "is_active",
            "date_joined",
        ]
        read_only_fields = ["date_joined"]

    def get_roles(self, obj):
        return list(
            UserRole.objects.filter(user=obj)
            .select_related("role")
            .values_list("role__code", flat=True)
        )


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "bio",
            "password",
            "is_active",
            "must_reset_password",
            "is_suspended",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

