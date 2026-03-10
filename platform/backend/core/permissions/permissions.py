from rest_framework.permissions import BasePermission

from core.permissions.services import user_has_permission


class HasPermissionCode(BasePermission):
    permission_code: str | None = None

    def has_permission(self, request, view):
        required = self.permission_code or getattr(view, "required_permission", None)
        if not required:
            return bool(request.user and request.user.is_authenticated)
        return user_has_permission(request.user, required)


def permission_required(permission_code: str):
    name = f"HasPermission_{permission_code.replace('.', '_')}"
    return type(name, (HasPermissionCode,), {"permission_code": permission_code})

