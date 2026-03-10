from integrations.chatbot.models import ChatbotIntegration


def get_active_chatbot():
    return ChatbotIntegration.objects.filter(is_active=True).order_by("-updated_at").first()

