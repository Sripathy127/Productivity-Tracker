"""Recolour the built-in categories to the current default palette.

Only rows that are still marked `is_default` are touched, and only when their
colour differs, so a category you have deliberately recoloured or renamed is
left exactly as it is.

    backend/.venv/Scripts/python.exe backend/scripts/resync_default_palette.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running this script directly from anywhere, not just from `backend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Category
from app.services.seed import DEFAULT_CATEGORIES


def main() -> None:
    wanted = dict(DEFAULT_CATEGORIES)

    with SessionLocal() as session:
        defaults = (
            session.execute(select(Category).where(Category.is_default.is_(True)))
            .scalars()
            .all()
        )

        updated = 0
        for category in defaults:
            target = wanted.get(category.name)
            if target is None or category.color == target:
                continue
            category.color = target
            updated += 1

        session.commit()

    if updated:
        print(f"Recoloured {updated} built-in category(ies).")
    else:
        print("Nothing to do: the built-in palette already matches.")


if __name__ == "__main__":
    main()
