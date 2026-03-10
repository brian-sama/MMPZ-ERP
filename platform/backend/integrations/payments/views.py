from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from integrations.payments.models import PaymentIntegration
from integrations.payments.permissions import ManagePaymentsPermission
from integrations.payments.serializers import PaymentIntegrationSerializer


class PaymentIntegrationViewSet(viewsets.ModelViewSet):
    queryset = PaymentIntegration.objects.all()
    serializer_class = PaymentIntegrationSerializer
    permission_classes = [IsAuthenticated, ManagePaymentsPermission]
