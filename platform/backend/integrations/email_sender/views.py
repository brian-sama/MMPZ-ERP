from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from integrations.email_sender.models import EmailIntegration
from integrations.email_sender.permissions import ManageEmailIntegrationPermission
from integrations.email_sender.serializers import EmailIntegrationSerializer


class EmailIntegrationViewSet(viewsets.ModelViewSet):
    queryset = EmailIntegration.objects.all()
    serializer_class = EmailIntegrationSerializer
    permission_classes = [IsAuthenticated, ManageEmailIntegrationPermission]
