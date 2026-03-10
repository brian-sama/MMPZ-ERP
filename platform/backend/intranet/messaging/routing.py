from django.urls import re_path

from intranet.messaging.consumers import MessagingConsumer

websocket_urlpatterns = [
    re_path(r"^ws/messaging/(?P<room_id>[-\\w]+)/$", MessagingConsumer.as_asgi()),
]
