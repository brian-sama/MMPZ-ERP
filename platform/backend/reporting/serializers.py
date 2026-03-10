from rest_framework import serializers

from reporting.models import ReportDefinition, ReportRun


class ReportDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportDefinition
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class ReportRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportRun
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

