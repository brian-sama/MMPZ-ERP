import csv
from datetime import datetime

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.roles.models import Role, UserRole
from core.roles.permissions import ManageRolesPermission
from core.roles.serializers import RoleSerializer, UserRoleSerializer
from core.roles.services import seed_canonical_roles


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, ManageRolesPermission]

    def get_queryset(self):
        seed_canonical_roles()
        return super().get_queryset()

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="roles-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(["code", "name", "description", "is_executive", "created_at"])
        for role in self.get_queryset():
            writer.writerow([role.code, role.name, role.description, role.is_executive, role.created_at])
        return response


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.select_related("user", "role", "assigned_by").all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, ManageRolesPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        user_id = self.request.query_params.get("user_id")
        role_code = self.request.query_params.get("role_code")
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if role_code:
            queryset = queryset.filter(role_id=role_code)
        return queryset

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        assignments = request.data.get("assignments") or []
        if not isinstance(assignments, list) or not assignments:
            return Response({"detail": "assignments must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)
        created = 0
        for item in assignments:
            user_id = item.get("user_id")
            role_code = item.get("role_code")
            if not user_id or not role_code:
                continue
            _, was_created = UserRole.objects.get_or_create(
                user_id=user_id,
                role_id=role_code,
                defaults={"assigned_by": request.user, "is_primary": bool(item.get("is_primary", False))},
            )
            if was_created:
                created += 1
        return Response({"created": created}, status=status.HTTP_201_CREATED)
