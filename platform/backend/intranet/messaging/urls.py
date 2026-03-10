from django.urls import include, path
from rest_framework.routers import DefaultRouter

from intranet.messaging.views import MessageChannelViewSet, MessageViewSet

router = DefaultRouter()
router.register("messaging/channels", MessageChannelViewSet, basename="message-channel")
router.register("messaging/messages", MessageViewSet, basename="message")

urlpatterns = [path("", include(router.urls))]

