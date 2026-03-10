from rest_framework import serializers

from intranet.messaging.models import Message, MessageChannel


class MessageChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageChannel
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "sender"]

