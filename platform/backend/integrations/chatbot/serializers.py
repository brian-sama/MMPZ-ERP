from rest_framework import serializers

from integrations.chatbot.models import ChatbotIntegration


class ChatbotIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotIntegration
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

