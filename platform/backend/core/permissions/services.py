from typing import Iterable

from django.db import connection

from core.permissions.models import Permission
from core.roles.models import UserRole


def get_user_permission_codes(user) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return set(Permission.objects.values_list("code", flat=True))

    role_codes = list(UserRole.objects.filter(user=user).values_list("role_id", flat=True))
    if not role_codes:
        return set()

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT permission_code FROM role_permissions WHERE role_code = ANY(%s)",
            (role_codes,),
        )
        rows = cursor.fetchall()
    return {row[0] for row in rows}


def user_has_permission(user, permission_code: str) -> bool:
    return permission_code in get_user_permission_codes(user)


def assign_permissions_to_role(role, permission_codes: Iterable[str]) -> None:
    permission_codes = set(permission_codes)
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM role_permissions WHERE role_code = %s", (role.code,))
        for permission_code in permission_codes:
            cursor.execute(
                """
                INSERT INTO role_permissions (role_code, permission_code, created_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (role_code, permission_code) DO NOTHING
                """,
                (role.code, permission_code),
            )

