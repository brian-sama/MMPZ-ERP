from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from integrations.chatbot.models import ChatbotIntegration
from integrations.chatbot.permissions import ManageChatbotPermission
from integrations.chatbot.serializers import ChatbotIntegrationSerializer


class ChatbotIntegrationViewSet(viewsets.ModelViewSet):
    queryset = ChatbotIntegration.objects.all()
    serializer_class = ChatbotIntegrationSerializer
    permission_classes = [IsAuthenticated, ManageChatbotPermission]
