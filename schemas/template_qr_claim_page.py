from pydantic import Field

from coffeebreak.schemas import BaseComponent as BaseComponentSchema


class TemplateQrClaimPage(BaseComponentSchema):
    """Schema for participant QR claim scanner component."""

    title: str = Field(
        default="Claim Points",
        description="Title shown above the QR claim scanner",
        optional=True,
    )
    success_timeout_ms: int = Field(
        default=1500,
        ge=500,
        le=5000,
        description="How long success message is shown before scanner resumes",
        optional=True,
    )
