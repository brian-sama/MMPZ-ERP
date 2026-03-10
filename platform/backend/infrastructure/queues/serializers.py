from rest_framework import serializers

from infrastructure.queues.models import JobRecord


class JobRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRecord
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

