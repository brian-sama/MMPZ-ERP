from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from infrastructure.cache.services import invalidate_cache_keys
from intranet.messaging.models import Message, MessageChannel
from intranet.messaging.permissions import ViewMessagingPermission
from intranet.messaging.serializers import MessageChannelSerializer, MessageSerializer
from intranet.messaging.services import log_message_sent


class MessageChannelViewSet(SoftDeleteModelViewSet):
    queryset = MessageChannel.objects.select_related("created_by").all()
    serializer_class = MessageChannelSerializer
    permission_classes = [IsAuthenticated, ViewMessagingPermission]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.select_related("channel", "sender").all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, ViewMessagingPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        channel_id = self.request.query_params.get("channel_id")
        unread_only = self.request.query_params.get("unread_only")
        if channel_id:
            queryset = queryset.filter(channel_id=channel_id)
        if unread_only in {"1", "true", "True"}:
            queryset = queryset.filter(is_read=False)
        return queryset

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        log_message_sent(
            channel_id=message.channel_id,
            sender_id=self.request.user.id,
            content=message.content,
            attachment_path=message.attachment_path,
        )
        invalidate_cache_keys("dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="message.sent",
            entity="intranet.message",
            entity_id=str(message.id),
            details={"channel_id": message.channel_id},
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if not message.is_read:
            message.is_read = True
            message.save(update_fields=["is_read", "updated_at"])
        return Response({"id": message.id, "is_read": message.is_read})
