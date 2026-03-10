from django.contrib import admin
from django.conf import settings
from django.urls import include, path
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.schemas import get_schema_view


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "unified-enterprise-backend"})


urlpatterns = [
    path("health/", health, name="health"),
    path(
        "api/schema/",
        get_schema_view(
            title="Unified Enterprise Portal API",
            description="OpenAPI schema for versioned ERP + Intranet APIs.",
            version="v1",
            permission_classes=[AllowAny],
        ),
        name="openapi-schema",
    ),
    path("api/v1/", include("config.api_v1_urls")),
    path("api/v2/", include("config.api_v2_urls")),
]

if settings.ALLOW_DJANGO_ADMIN:
    urlpatterns.insert(0, path("admin/", admin.site.urls))
