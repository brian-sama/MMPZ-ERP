from django.db import models

from core.common.models import TimestampedModel


class PaymentIntegration(TimestampedModel):
    provider = models.CharField(max_length=80)
    merchant_id = models.CharField(max_length=120)
    api_key_ref = models.CharField(max_length=180)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "integration_payments"
