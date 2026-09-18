"""Per-account seeding of the default category palette.

The six colours are the *light* steps of a validated categorical palette, not a
taste decision. They were chosen by running the data-viz palette validator
against this app's two chart surfaces and keeping an ordering that clears every
hard gate in both modes: lightness band, chroma floor, contrast, adjacent-pair
CVD separation, and adjacent-pair normal-vision separation.

An earlier hand-picked "muted harmonious" set failed hard — two of its colours
sat at normal-vision dE 6.0, meaning full-colour-vision readers could not tell
those categories apart. Do not re-mute these for looks without re-running the
validator.

Orange is deliberately absent: clay is the interface accent, and an orange
category would make an accent read as data.

The matching dark steps, and the reasoning, live in
`frontend/src/lib/category-palette.ts`. The insertion order here *is* the
palette order, and the stacked bar depends on it, so do not reorder these rows.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category

DEFAULT_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("Deep Work", "#2a78d6"),  # slot 1, blue
    ("Meeting", "#1baf7a"),  # slot 2, aqua
    ("Learning", "#eda100"),  # slot 3, yellow
    ("Admin", "#e87ba4"),  # slot 4, magenta
    ("Break", "#008300"),  # slot 5, green
    ("Personal", "#4a3aa7"),  # slot 6, violet
)


def seed_default_categories(db: Session, user_id: int) -> int:
    """Insert the default categories for a user that has none.

    Returns the number of rows inserted so callers can log it. Existing rows
    are never touched, which makes this safe to call on every sign-in.
    """
    existing = db.execute(
        select(func.count()).select_from(Category).where(Category.user_id == user_id)
    ).scalar_one()
    if existing:
        return 0

    db.add_all(
        Category(user_id=user_id, name=name, color=color, is_default=True)
        for name, color in DEFAULT_CATEGORIES
    )
    db.flush()
    return len(DEFAULT_CATEGORIES)
