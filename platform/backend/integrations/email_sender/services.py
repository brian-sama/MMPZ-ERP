from integrations.email_sender.models import EmailIntegration


def get_active_email_integration():
    return EmailIntegration.objects.filter(is_active=True).order_by("-updated_at").first()

