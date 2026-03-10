from rest_framework import serializers

from intranet.directory.models import DirectoryEntry, KnowledgeArticle


class DirectoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryEntry
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class KnowledgeArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeArticle
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

