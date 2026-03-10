from rest_framework import serializers

from infrastructure.storage.models import StoredFile


class StoredFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoredFile
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

