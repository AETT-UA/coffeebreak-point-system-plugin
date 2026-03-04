import base64
import hashlib
import hmac
import json
from io import BytesIO
from typing import List

import qrcode
from coffeebreak.utils.api import Router, Depends, HTTPException
from coffeebreak.dependencies.auth import check_role, get_current_user
from coffeebreak.dependencies.database import get_db
from coffeebreak.config import settings
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..schemas.transaction_template import (
    Base,
    Update,
    Response,
    ExecuteRequest,
    PermissionsResponse,
    QrClaimRequest,
    UserPermissionCreate,
    RolePermissionCreate,
)
from ..schemas.point_system import TransactionRequest, TransactionType, Transaction
from ..services.transaction_template_service import TransactionTemplateService
from ..services.point_system_service import (
    PointSystemService,
    PointSystemUnavailable,
    UpstreamPointSystemError,
)

ROLE = "manage_transaction_templates"
BYPASS_ROLE = "manage_all_point_transactions"

router = Router()


def _get_qr_secret() -> bytes:
    secret = getattr(settings, "anon_jwt_secret", None) or "dev-secret"
    return str(secret).encode("utf-8")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    padded = raw + "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(padded.encode("utf-8"))


def _encode_template_qr_token(template_id: int) -> str:
    payload = json.dumps(
        {"template_id": template_id, "v": 1}, separators=(",", ":")
    ).encode("utf-8")
    payload_encoded = _b64url_encode(payload)
    signature = hmac.new(_get_qr_secret(), payload, hashlib.sha256).digest()
    signature_encoded = _b64url_encode(signature)
    return f"cbps-template:{payload_encoded}.{signature_encoded}"


def _decode_template_qr_token(token: str) -> int:
    prefix = "cbps-template:"
    if not token.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid template QR token format.")

    compact = token[len(prefix) :]
    if "." not in compact:
        raise HTTPException(status_code=400, detail="Invalid template QR token format.")

    payload_encoded, signature_encoded = compact.split(".", 1)

    try:
        payload = _b64url_decode(payload_encoded)
        provided_signature = _b64url_decode(signature_encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed template QR token.")

    expected_signature = hmac.new(_get_qr_secret(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(provided_signature, expected_signature):
        raise HTTPException(
            status_code=400, detail="Invalid template QR token signature."
        )

    try:
        payload_data = json.loads(payload.decode("utf-8"))
        template_id = int(payload_data["template_id"])
    except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid template QR token payload."
        )

    return template_id


def _qr_png_response(content: str) -> StreamingResponse:
    qr = qrcode.make(content)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


@router.get("", response_model=List[Response])
async def get_all_templates(
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.list_templates()


@router.get("/accessible", response_model=List[Response])
async def get_accessible_templates(
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user()),
):
    """Return templates the caller can execute (role or ACL match)."""
    service = TransactionTemplateService(db)
    return [
        t
        for t in service.list_templates()
        if service.can_execute_template(t.id, user_info, BYPASS_ROLE)
    ]


@router.post("", response_model=Response)
async def create_template(
    template: Base,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.create_template(template)


@router.get("/{template_id}", response_model=Response)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    template = service.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/{template_id}/qr")
async def get_template_qr(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    template = service.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if not bool(getattr(template, "qr_enabled", False)):
        raise HTTPException(
            status_code=422,
            detail="Template QR claims are disabled. Enable qr_enabled first.",
        )

    token = _encode_template_qr_token(template_id)
    return _qr_png_response(token)


@router.patch("/{template_id}", response_model=Response)
async def update_template(
    template_id: int,
    template: Update,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.update_template(template_id, template)


@router.delete("/{template_id}", response_model=Response)
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.delete_template(template_id)


@router.post("/{template_id}/execute", response_model=Transaction)
async def execute_template(
    template_id: int,
    payload: ExecuteRequest,
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user()),
):
    service = TransactionTemplateService(db)
    template = service.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if not service.can_execute_template(template_id, user_info, BYPASS_ROLE):
        raise HTTPException(status_code=403, detail="Access denied")

    service.ensure_claim_limit_available(template, payload.user_id)

    transaction_type = (
        TransactionType.ACTIVITY
        if template.activity_id is not None
        else TransactionType.MANUAL
    )

    points_mode = str(
        getattr(template, "points_mode", "automatic") or "automatic"
    ).lower()
    if points_mode == "manual":
        raise HTTPException(
            status_code=422,
            detail=(
                "This template is configured for manual points input and cannot be executed directly. "
                "Use the staff activity scan flow."
            ),
        )

    request = TransactionRequest(
        activity_id=template.activity_id,
        points=PointSystemService._round_points(template.points),
        description=template.description or f"Template execution: {template.name}",
    )

    try:
        transaction = await PointSystemService.points.create_transaction(
            payload.user_id, request, transaction_type
        )
        if transaction is None:
            raise HTTPException(status_code=502, detail="Failed to execute template")

        service.record_template_claim(template.id, payload.user_id, transaction.id)
        return transaction
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/claim", response_model=Transaction)
async def claim_template_via_qr(
    payload: QrClaimRequest,
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user()),
):
    user_sub = str(user_info.get("sub") or "").strip()
    if not user_sub and user_info.get("user_id"):
        user_sub = str(user_info.get("user_id") or "").strip()

    if not user_sub:
        raise HTTPException(status_code=401, detail="Authenticated user id not found.")

    template_id = _decode_template_qr_token(payload.token.strip())

    service = TransactionTemplateService(db)
    template = service.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if not bool(getattr(template, "qr_enabled", False)):
        raise HTTPException(
            status_code=403,
            detail="Template QR claims are disabled.",
        )

    points_mode = str(
        getattr(template, "points_mode", "automatic") or "automatic"
    ).lower()
    if points_mode != "automatic":
        raise HTTPException(
            status_code=422,
            detail="Template requires manual points input and cannot be claimed via QR.",
        )

    points = PointSystemService._round_points(template.points)
    if points <= 0:
        raise HTTPException(
            status_code=422,
            detail=f"Template '{template.name}' has invalid points configuration.",
        )

    service.ensure_claim_limit_available(template, user_sub)

    transaction_type = (
        TransactionType.ACTIVITY
        if template.activity_id is not None
        else TransactionType.MANUAL
    )

    request = TransactionRequest(
        activity_id=template.activity_id,
        points=points,
        description=template.description or f"QR claim: {template.name}",
    )

    try:
        transaction = await PointSystemService.points.create_transaction(
            user_sub,
            request,
            transaction_type,
        )
        if transaction is None:
            raise HTTPException(
                status_code=502, detail="Failed to execute template claim"
            )

        service.register_qr_claim(
            template_id=template.id,
            user_sub=user_sub,
            transaction_id=transaction.id,
        )
        return transaction
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/{template_id}/permissions", response_model=PermissionsResponse)
async def get_template_permissions(
    template_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.list_permissions(template_id)


@router.post("/{template_id}/permissions/users", response_model=PermissionsResponse)
async def add_template_user_permission(
    template_id: int,
    payload: UserPermissionCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.add_user_permission(template_id, payload)


@router.delete(
    "/{template_id}/permissions/users/{user_sub}", response_model=PermissionsResponse
)
async def remove_template_user_permission(
    template_id: int,
    user_sub: str,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.remove_user_permission(template_id, user_sub)


@router.post("/{template_id}/permissions/roles", response_model=PermissionsResponse)
async def add_template_role_permission(
    template_id: int,
    payload: RolePermissionCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.add_role_permission(template_id, payload)


@router.delete(
    "/{template_id}/permissions/roles/{role_name}", response_model=PermissionsResponse
)
async def remove_template_role_permission(
    template_id: int,
    role_name: str,
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.remove_role_permission(template_id, role_name)
