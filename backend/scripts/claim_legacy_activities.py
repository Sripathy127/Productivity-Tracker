"""Assign ownerless activities to an account.

Activities created before accounts existed have ``user_id = NULL`` and are
invisible to every API route (which all scope to the signed-in user). This
script hands them to one account rather than deleting them.

Usage — list what is unowned:

    backend/.venv/Scripts/python.exe backend/scripts/claim_legacy_activities.py

Then claim them:

    backend/.venv/Scripts/python.exe backend/scripts/claim_legacy_activities.py you@example.com
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running this script directly from anywhere, not just from `backend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import Activity, Category, User


def main() -> None:
    with SessionLocal() as session:
        unowned = session.execute(
            select(func.count()).select_from(Activity).where(Activity.user_id.is_(None))
        ).scalar_one()

        if len(sys.argv) < 2:
            print(f"{unowned} activity(ies) have no owner.")
            users = session.execute(select(User).order_by(User.id)).scalars().all()
            if not users:
                print("No accounts exist yet. Sign in once, then re-run with an email.")
                return
            print("\nAccounts:")
            for user in users:
                print(f"  {user.email}  (id {user.id})")
            print("\nRe-run with one of those emails to claim the activities.")
            return

        email = sys.argv[1].strip().lower()
        user = session.execute(
            select(User).where(User.email == email)
        ).scalar_one_or_none()
        if user is None:
            raise SystemExit(f"No account with email {email!r}. Sign in first.")

        if unowned == 0:
            print("Nothing to claim.")
            return

        # Legacy activities point at legacy ownerless categories. The account
        # already has its own palette with the same default names, and
        # (user_id, name) is unique, so reassigning the legacy rows outright
        # would collide. Merge by name instead: point the activities at the
        # account's equivalent category and drop the legacy row.
        owned_by_name = {
            category.name: category
            for category in session.execute(
                select(Category).where(Category.user_id == user.id)
            )
            .scalars()
            .all()
        }
        legacy_categories = (
            session.execute(select(Category).where(Category.user_id.is_(None)))
            .scalars()
            .all()
        )

        merged = 0
        adopted = 0
        for legacy in legacy_categories:
            equivalent = owned_by_name.get(legacy.name)
            if equivalent is None:
                legacy.user_id = user.id
                adopted += 1
                continue
            session.query(Activity).filter(Activity.category_id == legacy.id).update(
                {Activity.category_id: equivalent.id}, synchronize_session=False
            )
            session.delete(legacy)
            merged += 1

        claimed = (
            session.query(Activity)
            .filter(Activity.user_id.is_(None))
            .update({Activity.user_id: user.id}, synchronize_session=False)
        )
        session.commit()
        print(
            f"Claimed {claimed} activity(ies) for {email}: "
            f"{merged} category(ies) merged into the existing palette, "
            f"{adopted} adopted as-is."
        )


if __name__ == "__main__":
    main()
