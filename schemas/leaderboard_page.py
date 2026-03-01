from typing import Optional

from pydantic import Field

from coffeebreak.schemas import BaseComponent as BaseComponentSchema


class LeaderboardPage(BaseComponentSchema):
    """Schema for the leaderboard component shown in event app pages."""

    title: str = Field(
        default="Event Leaderboard",
        description="Title shown above the leaderboard",
        optional=True,
    )
    activity_id: Optional[int] = Field(
        default=None,
        description="Optional activity id to show activity-specific leaderboard",
        optional=True,
    )
    limit: int = Field(
        default=10,
        ge=1,
        description="Maximum number of rows to display",
        optional=True,
    )
    show_rank: bool = Field(
        default=True,
        description="Whether to show the rank column",
        optional=True,
    )
    refresh_seconds: int = Field(
        default=30,
        ge=0,
        description="Auto-refresh interval in seconds, set 0 to disable",
        optional=True,
    )
