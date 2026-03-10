from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("roles", "0003_rename_user_roles_role_id_0b583b_idx_user_roles_role_co_49fe4a_idx"),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE TABLE IF NOT EXISTS user_roles (
                id BIGSERIAL PRIMARY KEY,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                user_id BIGINT NOT NULL,
                role_code VARCHAR(80) NOT NULL,
                is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                assigned_by_id BIGINT NULL,
                UNIQUE (user_id, role_code),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);
            CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role_code);
            """,
            reverse_sql="DROP TABLE IF EXISTS user_roles;",
        ),
    ]
