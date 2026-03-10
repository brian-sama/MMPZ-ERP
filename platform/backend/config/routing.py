from core.notifications.routing import websocket_urlpatterns as notification_ws
from intranet.messaging.routing import websocket_urlpatterns as messaging_ws

websocket_urlpatterns = [
    *notification_ws,
    *messaging_ws,
]
