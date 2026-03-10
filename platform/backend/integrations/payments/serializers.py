from rest_framework import serializers

from integrations.payments.models import PaymentIntegration


class PaymentIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentIntegration
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

