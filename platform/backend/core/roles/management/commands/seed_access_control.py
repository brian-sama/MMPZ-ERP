from django.core.management.base import BaseCommand
from django.db import connection

from core.permissions.models import Permission
from core.roles.services import seed_canonical_roles


ROLE_PERMISSIONS = {
    "ADMIN": [
        "members.view",
        "members.edit",
        "finance.approve",
        "inventory.manage",
        "documents.upload",
    ],
    "MANAGER": ["members.view", "members.edit", "documents.upload"],
    "FINANCE_OFFICER": ["members.view", "finance.approve", "documents.upload"],
    "STAFF": ["members.view", "documents.upload", "inventory.manage"],
    "MEMBER": ["members.view"],
}


class Command(BaseCommand):
    help = "Seed canonical roles and permissions for Unified Enterprise Portal."

    def handle(self, *args, **options):
        seed_canonical_roles()

        for code in {
            "members.view",
            "members.edit",
            "finance.approve",
            "inventory.manage",
            "documents.upload",
        }:
            updated = Permission.objects.filter(code=code).update(description=code)
            if not updated:
                Permission.objects.create(code=code, description=code)

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM role_permissions")
            for role_code, permission_codes in ROLE_PERMISSIONS.items():
                for permission_code in permission_codes:
                    cursor.execute(
                        """
                        INSERT INTO role_permissions (role_code, permission_code, created_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (role_code, permission_code) DO NOTHING
                        """,
                        (role_code, permission_code),
                    )

        self.stdout.write(self.style.SUCCESS("Seeded access-control roles and permissions."))
