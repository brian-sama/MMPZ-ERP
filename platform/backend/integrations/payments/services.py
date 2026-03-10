from integrations.payments.models import PaymentIntegration


def get_active_payment_provider():
    return PaymentIntegration.objects.filter(is_active=True).order_by("-updated_at").first()

