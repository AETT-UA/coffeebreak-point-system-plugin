from pydantic import BaseModel, Field

class Settings(BaseModel):
    """Plugin settings for the Point System Plugin"""
    point_system_url: str = Field(
        default="http://point-system.deti4devs.pt",
        title="Point System Service URL",
        description="Base URL for the external point system service",
        placeholder="http://point-system.deti4devs.pt"
    )
    connection_timeout: float = Field(
        default=30.0,
        title="Connection Timeout",
        description="Timeout in seconds for HTTP requests to the point system service",
        ge=1.0,
        le=300.0
    )
    retry_attempts: int = Field(
        default=3,
        title="Retry Attempts",
        description="Number of retry attempts for failed HTTP requests",
        ge=1,
        le=10
    )
