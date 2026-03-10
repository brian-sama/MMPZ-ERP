import json

from channels.generic.websocket import AsyncWebsocketConsumer


class MessagingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        room_id = self.scope["url_route"]["kwargs"].get("room_id")
        if not user or not user.is_authenticated or not room_id:
            await self.close(code=4001)
            return
        self.room_group_name = f"chat_{room_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        payload = json.loads(text_data)
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message", "payload": payload},
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event.get("payload", {})))
