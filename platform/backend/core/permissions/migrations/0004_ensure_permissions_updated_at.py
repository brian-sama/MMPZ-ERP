from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("permissions", "0003_create_role_permissions_table"),
    ]

    operations = [
        migrations.RunSQL(
            """
            ALTER TABLE permissions
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
            UPDATE permissions
            SET updated_at = created_at
            WHERE updated_at IS NULL;
            """,
            reverse_sql="""
            ALTER TABLE permissions
            DROP COLUMN IF EXISTS updated_at;
            """,
        ),
    ]
