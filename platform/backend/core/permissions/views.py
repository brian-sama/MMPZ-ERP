from django.db import connection
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.permissions.models import Permission
from core.permissions.permissions import permission_required
from core.permissions.serializers import PermissionSerializer, RolePermissionSerializer
from core.roles.models import Role


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, permission_required("documents.upload")]


class RolePermissionViewSet(ViewSet):
    permission_classes = [IsAuthenticated, permission_required("documents.upload")]

    def list(self, request):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT role_code, permission_code, created_at FROM role_permissions ORDER BY role_code, permission_code"
            )
            rows = cursor.fetchall()
        data = [
            {"role_code": role, "permission_code": permission, "created_at": created_at}
            for role, permission, created_at in rows
        ]
        return Response(RolePermissionSerializer(data, many=True).data)

    def create(self, request):
        serializer = RolePermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_code = serializer.validated_data["role_code"]
        permission_code = serializer.validated_data["permission_code"]

        if not Role.objects.filter(code=role_code).exists():
            return Response({"detail": "Role not found"}, status=status.HTTP_404_NOT_FOUND)
        if not Permission.objects.filter(code=permission_code).exists():
            return Response({"detail": "Permission not found"}, status=status.HTTP_404_NOT_FOUND)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role_code, permission_code),
            )
        return Response(serializer.validated_data, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        if not pk or ":" not in pk:
            return Response(
                {"detail": "Use pk format role_code:permission_code"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role_code, permission_code = pk.split(":", 1)
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM role_permissions WHERE role_code = %s AND permission_code = %s",
                (role_code, permission_code),
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
