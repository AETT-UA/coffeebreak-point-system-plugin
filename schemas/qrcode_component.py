from schemas.ui.page import BaseComponentSchema
from pydantic import Field

class QrCode(BaseComponentSchema):
    """
    Schema for QR Code component.
    """
    message: str = Field(..., description="Message to show bellow the QrCode.")
    alt_text: str = Field(..., description="Alt text for the QR code image.")
