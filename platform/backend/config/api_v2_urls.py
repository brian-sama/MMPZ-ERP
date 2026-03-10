from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def v2_placeholder(request):
    return Response(
        {
            "detail": "API v2 namespace is reserved for forward-compatible endpoints.",
            "available": False,
        },
        status=200,
    )


urlpatterns = [path("", v2_placeholder, name="api-v2-placeholder")]
