from rest_framework import serializers

from integrations.email_sender.models import EmailIntegration


class EmailIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailIntegration
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

