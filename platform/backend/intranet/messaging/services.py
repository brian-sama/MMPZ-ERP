from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.notifications.services import create_system_event


def log_message_sent(channel_id: int, sender_id: int | None, content: str = "", attachment_path: str = ""):
    create_system_event(
        event_type="messaging.message_sent",
        payload={"channel_id": channel_id, "sender_id": sender_id},
    )
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f"chat_{channel_id}",
            {
                "type": "chat_message",
                "payload": {
                    "channel_id": channel_id,
                    "sender_id": sender_id,
                    "content": content,
                    "attachment_path": attachment_path,
                },
            },
        )

