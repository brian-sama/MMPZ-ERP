from rest_framework import serializers

from intranet.documents.models import Document, DocumentVersion


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

