from typing import List
from coffeebreak import Router, Depends, HTTPException
from coffeebreak.auth import check_role
from coffeebreak.db import DB as get_db
from sqlalchemy.orm import Session

from ..schemas.transaction_template import (
    Base, Update, Response
)

from ..services.transaction_template_service import TransactionTemplateService
import logging

logger = logging.getLogger("coffeebreak.point-system.transaction-template")

ROLE = "manage_transaction_templates"

router = Router()

@router.get("", response_model=List[Response])
async def get_all_templates(
    db: Session = Depends(get_db),
    #_: dict = Depends(check_role([ROLE]))
):
    """List all transaction templates"""
    service = TransactionTemplateService(db)
    return service.list_templates()

@router.post("", response_model=Response)
async def create_template(
    template: Base,
    db: Session = Depends(get_db),
    #_: dict = Depends(check_role([ROLE]))
):
    """Create a new transaction template"""
    service = TransactionTemplateService(db)
    return service.create_template(template)

@router.get("/{template_id}", response_model=Response)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    #_: dict = Depends(check_role([ROLE]))
):
    """Get a specific transaction template by ID"""
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
    #_: dict = Depends(check_role([ROLE]))
):
    """Update a specific transaction template by ID"""
    service = TransactionTemplateService(db)
    return service.update_template(template_id, template)
