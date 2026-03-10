from django.urls import include, path
from rest_framework.routers import DefaultRouter

from integrations.chatbot.views import ChatbotIntegrationViewSet

router = DefaultRouter()
router.register("integrations/chatbot", ChatbotIntegrationViewSet, basename="chatbot-integration")

urlpatterns = [path("", include(router.urls))]

