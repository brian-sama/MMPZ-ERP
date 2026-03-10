from django.urls import include, path
from rest_framework.routers import DefaultRouter

from integrations.email_sender.views import EmailIntegrationViewSet

router = DefaultRouter()
router.register("integrations/email", EmailIntegrationViewSet, basename="email-integration")

urlpatterns = [path("", include(router.urls))]

