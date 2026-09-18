"""One-off migration: add accounts to a database created before they existed.

`Base.metadata.create_all` creates missing *tables* but never alters existing
ones, so a database from before this change has no `activities.user_id` and no
`categories.user_id`, and still carries the old global `UNIQUE(name)` on
categories. This script closes that gap without dropping data.

It is idempotent: run it as many times as you like.

    backend/.venv/Scripts/python.exe backend/scripts/migrate_add_accounts.py

Afterwards, sign in once and then hand the pre-existing rows to your account:

    backend/.venv/Scripts/python.exe backend/scripts/claim_legacy_activities.py you@example.com

(This is the point at which a migration tool such as Alembic would have paid
for itself; see ARCHITECTURE.md.)
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running this script directly from anywhere, not just from `backend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect

from app.core.config import get_settings
from app.core.db import Base, engine
from app.models import Activity, Category, SubActivity, User  # noqa: F401

CATEGORIES_DDL = """
CREATE TABLE categories_new (
    id INTEGER NOT NULL PRIMARY KEY,
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    color VARCHAR(7) NOT NULL,
    is_default BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT uq_category_owner_name UNIQUE (user_id, name)
)
"""


def main() -> None:
    settings = get_settings()
    if not settings.is_sqlite:
        raise SystemExit(
            "This migration only handles SQLite. On Postgres, add the two "
            "user_id columns and swap the categories unique constraint with "
            "plain ALTER TABLE statements."
        )

    # Creates `users` (and anything else missing) but leaves existing tables be.
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    activity_columns = (
        {column["name"] for column in inspector.get_columns("activities")}
        if "activities" in tables
        else set()
    )
    category_columns = (
        {column["name"] for column in inspector.get_columns("categories")}
        if "categories" in tables
        else set()
    )

    actions: list[str] = []

    # A raw DBAPI connection is used deliberately. `PRAGMA foreign_keys` is a
    # no-op inside a transaction, and the rebuild below *requires* enforcement
    # to be off: with foreign keys ON, SQLite's DROP TABLE performs an implicit
    # row-by-row delete, which fires `activities.category_id`'s ON DELETE SET
    # NULL and silently discards every activity's category.
    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")

        if "activities" in tables and "user_id" not in activity_columns:
            cursor.execute("ALTER TABLE activities ADD COLUMN user_id INTEGER")
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS ix_activities_user_id "
                "ON activities (user_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS ix_activities_user_start_end "
                "ON activities (user_id, start_at, end_at)"
            )
            actions.append("added activities.user_id")

        if "categories" in tables:
            row = cursor.execute(
                "SELECT sql FROM sqlite_master "
                "WHERE type = 'table' AND name = 'categories'"
            ).fetchone()
            stored_ddl = (row[0] if row is not None and row[0] else "") or ""

            # Rebuild when the owner column is missing, or when an earlier run
            # produced a table without `created_at`'s default (which makes
            # every later insert fail the NOT NULL constraint).
            needs_rebuild = (
                "user_id" not in category_columns
                or "CURRENT_TIMESTAMP" not in stored_ddl.upper()
            )
            if needs_rebuild:
                owner_expression = (
                    "user_id" if "user_id" in category_columns else "NULL"
                )
                cursor.execute("DROP TABLE IF EXISTS categories_new")
                cursor.execute(CATEGORIES_DDL)
                cursor.execute(
                    "INSERT INTO categories_new "
                    "(id, user_id, name, color, is_default, created_at) "
                    f"SELECT id, {owner_expression}, name, color, is_default, "
                    "created_at FROM categories"
                )
                cursor.execute("DROP TABLE categories")
                cursor.execute("ALTER TABLE categories_new RENAME TO categories")
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS ix_categories_user_id "
                    "ON categories (user_id)"
                )
                actions.append(
                    "rebuilt categories with per-owner unique names and a "
                    "created_at default"
                )

        raw.commit()

        # Confirm the rebuild left no dangling references behind.
        violations = cursor.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise SystemExit(
                f"Migration left {len(violations)} foreign-key violation(s). "
                "Restore your backup rather than continuing."
            )
        cursor.execute("PRAGMA foreign_keys=ON")

        unowned = cursor.execute(
            "SELECT COUNT(*) FROM activities WHERE user_id IS NULL"
        ).fetchone()[0]
        uncategorised = cursor.execute(
            "SELECT COUNT(*) FROM activities WHERE category_id IS NULL"
        ).fetchone()[0]
        cursor.close()
    finally:
        raw.close()

    if actions:
        for action in actions:
            print(f"  - {action}")
        print("\nMigration complete.")
    else:
        print("Nothing to do: the schema is already up to date.")

    if unowned:
        print(
            f"\n{unowned} activity(ies) have no owner and are not yet visible "
            "in the app.\nSign in once, then run claim_legacy_activities.py to "
            "hand them to your account."
        )
    if uncategorised:
        print(f"{uncategorised} activity(ies) are uncategorised.")


if __name__ == "__main__":
    main()
