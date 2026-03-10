import csv
from datetime import datetime

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.notifications.services import create_audit_log
from core.roles.models import UserRole
from core.users.permissions import EditUsersPermission, ViewUsersPermission
from core.users.serializers import UserCreateUpdateSerializer, UserSerializer
from core.users.services import get_user_profile_payload

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.all().order_by("id")
        q = self.request.query_params.get("q")
        role_code = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        is_suspended = self.request.query_params.get("is_suspended")

        if q:
            queryset = queryset.filter(
                Q(email__icontains=q)
                | Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        if role_code:
            queryset = queryset.filter(role_assignments__role_id=role_code)
        if is_active in {"true", "false", "1", "0"}:
            queryset = queryset.filter(is_active=is_active in {"true", "1"})
        if is_suspended in {"true", "false", "1", "0"}:
            queryset = queryset.filter(is_suspended=is_suspended in {"true", "1"})
        return queryset.distinct()

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UserCreateUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        base = [IsAuthenticated()]
        if self.action in {"list", "retrieve", "me", "export_csv"}:
            base.append(ViewUsersPermission())
        elif self.action in {"create", "update", "partial_update", "destroy", "bulk_update"}:
            base.append(EditUsersPermission())
        return base

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        return Response(get_user_profile_payload(request.user))

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        user_ids = request.data.get("user_ids") or []
        if not user_ids:
            return Response({"detail": "user_ids are required"}, status=status.HTTP_400_BAD_REQUEST)

        update_data = {}
        for field in ["is_active", "is_suspended", "must_reset_password"]:
            if field in request.data:
                update_data[field] = request.data[field]

        if not update_data:
            return Response({"detail": "No updatable fields provided"}, status=status.HTTP_400_BAD_REQUEST)

        updated = User.objects.filter(id__in=user_ids).update(**update_data)
        create_audit_log(
            actor=request.user,
            action="users.bulk_update",
            entity="core.user",
            details={"user_count": updated, "fields": update_data},
        )
        return Response({"updated": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="users-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "email",
                "username",
                "first_name",
                "last_name",
                "is_active",
                "is_suspended",
                "must_reset_password",
                "roles",
            ]
        )
        for user in self.get_queryset():
            roles = list(
                UserRole.objects.filter(user=user)
                .select_related("role")
                .values_list("role__code", flat=True)
            )
            writer.writerow(
                [
                    user.id,
                    user.email,
                    user.username,
                    user.first_name,
                    user.last_name,
                    user.is_active,
                    user.is_suspended,
                    user.must_reset_password,
                    ",".join(roles),
                ]
            )
        return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    return Response(get_user_profile_payload(request.user), status=status.HTTP_200_OK)
