"""
Legacy-to-portal migration helper for Big-Bang cutover rehearsal.

Usage:
  platform/backend/venv/Scripts/python.exe platform/scripts/migrate_legacy_data.py
"""

import os
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg2


ROLE_MAPPING = {
    "DIRECTOR": "ADMIN",
    "FINANCE_ADMIN_OFFICER": "FINANCE_OFFICER",
    "ADMIN_ASSISTANT": "STAFF",
    "LOGISTICS_ASSISTANT": "STAFF",
    "PSYCHOSOCIAL_SUPPORT_OFFICER": "MANAGER",
    "COMMUNITY_DEVELOPMENT_OFFICER": "MANAGER",
    "ME_INTERN_ACTING_OFFICER": "MANAGER",
    "SOCIAL_SERVICES_INTERN": "MEMBER",
    "YOUTH_COMMUNICATIONS_INTERN": "MEMBER",
    "DEVELOPMENT_FACILITATOR": "MEMBER",
}


def load_database_url() -> str:
    env_path = Path(".env")
    if not env_path.exists():
        raise RuntimeError(".env not found")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("DATABASE_URL missing in .env")


def get_connection(database_url: str):
    parsed = urlparse(database_url)
    return psycopg2.connect(
        dbname=parsed.path.lstrip("/"),
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        host=parsed.hostname or "localhost",
        port=parsed.port or 5432,
    )


def migrate_roles(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id, role_legacy_code FROM users WHERE role_legacy_code IS NOT NULL")
        rows = cur.fetchall()
        for user_id, legacy_code in rows:
            mapped = ROLE_MAPPING.get((legacy_code or "").upper(), "MEMBER")
            cur.execute("SELECT id FROM roles WHERE code = %s", (mapped,))
            role_row = cur.fetchone()
            if not role_row:
                continue
            role_id = role_row[0]
            cur.execute(
                """
                INSERT INTO user_roles (user_id, role_id, is_primary, created_at, updated_at)
                VALUES (%s, %s, TRUE, NOW(), NOW())
                ON CONFLICT (user_id, role_id) DO NOTHING
                """,
                (user_id, role_id),
            )


def main():
    database_url = os.getenv("DATABASE_URL") or load_database_url()
    conn = get_connection(database_url)
    conn.autocommit = False
    try:
        migrate_roles(conn)
        conn.commit()
        print("Legacy role migration completed.")
    except Exception as exc:
        conn.rollback()
        raise exc
    finally:
        conn.close()


if __name__ == "__main__":
    main()
