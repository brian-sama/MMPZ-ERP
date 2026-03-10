from core.roles.models import Role, UserRole

CANONICAL_ROLES = [
    ("ADMIN", "Admin", "Platform administrators", True),
    ("MANAGER", "Manager", "Department or program managers", False),
    ("FINANCE_OFFICER", "Finance Officer", "Finance approvals and ledgers", False),
    ("STAFF", "Staff", "Operational staff", False),
    ("MEMBER", "Member", "General members", False),
]


def seed_canonical_roles() -> None:
    for code, name, description, is_executive in CANONICAL_ROLES:
        updated = Role.objects.filter(code=code).update(
            name=name,
            description=description,
            is_executive=is_executive,
        )
        if not updated:
            Role.objects.create(
                code=code,
                name=name,
                description=description,
                is_executive=is_executive,
            )


def assign_primary_role(user, role, assigned_by=None) -> UserRole:
    UserRole.objects.filter(user=user, is_primary=True).update(is_primary=False)
    assignment, _ = UserRole.objects.get_or_create(
        user=user,
        role=role,
        defaults={"assigned_by": assigned_by, "is_primary": True},
    )
    if not assignment.is_primary:
        assignment.is_primary = True
        assignment.assigned_by = assigned_by
        assignment.save(update_fields=["is_primary", "assigned_by", "updated_at"])
    return assignment

