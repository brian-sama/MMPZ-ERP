from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0002_remove_permission_id_alter_permission_code_and_more"),
        ("roles", "0002_rename_user_roles_role_id_0b583b_idx_user_roles_role_co_49fe4a_idx_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_code VARCHAR(80) NOT NULL,
                permission_code VARCHAR(120) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (role_code, permission_code),
                FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE CASCADE,
                FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
            );
            """,
            reverse_sql="DROP TABLE IF EXISTS role_permissions;",
        ),
    ]
