from core.permissions.services import get_user_permission_codes
from core.roles.models import UserRole


def get_user_roles(user):
    return list(
        UserRole.objects.filter(user=user)
        .select_related("role")
        .values_list("role__code", flat=True)
    )


def get_user_profile_payload(user) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone_number": user.phone_number,
        "bio": user.bio,
        "roles": get_user_roles(user),
        "permissions": sorted(get_user_permission_codes(user)),
    }

