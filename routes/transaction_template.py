from typing import List
from coffeebreak.utils.api import Router, Depends, HTTPException
from coffeebreak.dependencies.auth import check_role, get_current_user
from coffeebreak.dependencies.database import get_db
from sqlalchemy.orm import Session

from ..schemas.transaction_template import (
    Base,
    Update,
    Response,
    ExecuteRequest,
    PermissionsResponse,
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


@router.get("", response_model=List[Response])
async def get_all_templates(
    db: Session = Depends(get_db),
    _: dict = Depends(check_role([ROLE])),
):
    service = TransactionTemplateService(db)
    return service.list_templates()


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

    transaction_type = (
        TransactionType.ACTIVITY
        if template.activity_id is not None
        else TransactionType.MANUAL
    )
    request = TransactionRequest(
        activity_id=template.activity_id,
        points=template.points,
        description=template.description or f"Template execution: {template.name}",
    )

    try:
        transaction = await PointSystemService.points.create_transaction(
            payload.user_id, request, transaction_type
        )
        if transaction is None:
            raise HTTPException(status_code=502, detail="Failed to execute template")
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
