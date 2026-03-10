from django.urls import include, path
from rest_framework.routers import DefaultRouter

from integrations.payments.views import PaymentIntegrationViewSet

router = DefaultRouter()
router.register("integrations/payments", PaymentIntegrationViewSet, basename="payment-integration")

urlpatterns = [path("", include(router.urls))]

