from django.db import models

from core.common.models import TimestampedModel


class ChatbotIntegration(TimestampedModel):
    provider = models.CharField(max_length=80)
    api_key_ref = models.CharField(max_length=180)
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "integration_chatbot"
