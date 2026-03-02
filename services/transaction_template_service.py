from datetime import datetime, timezone
from typing import List, Optional

from coffeebreak.utils.api import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.transaction_template import TransactionTemplate
from ..models.transaction_template_permission import (
    TransactionTemplateUserPermission,
    TransactionTemplateRolePermission,
)
from ..schemas import transaction_template as tp


class TransactionTemplateService:
    def __init__(self, db: Session):
        self.db: Session = db

    def _active_query(self):
        return self.db.query(TransactionTemplate).filter(
            TransactionTemplate.deleted_at.is_(None)
        )

    def create_template(self, template: tp.Base) -> TransactionTemplate:
        template_data = {k: v for k, v in template.dict().items() if v is not None}
        db_template = TransactionTemplate(**template_data)

        try:
            self.db.add(db_template)
            self.db.commit()
            self.db.refresh(db_template)
            return db_template
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Failed to create template")

    def list_templates(self) -> List[TransactionTemplate]:
        return self._active_query().all()

    def list_templates_for_activity(
        self, activity_id: int
    ) -> List[TransactionTemplate]:
        return (
            self._active_query()
            .filter(TransactionTemplate.activity_id == activity_id)
            .all()
        )

    def get_template(self, template_id: int) -> Optional[TransactionTemplate]:
        return (
            self._active_query().filter(TransactionTemplate.id == template_id).first()
        )

    def update_template(
        self, template_id: int, template_data: tp.Update
    ) -> TransactionTemplate:
        db_template = self.get_template(template_id)
        if not db_template:
            raise HTTPException(status_code=404, detail="Template not found")

        for key, value in template_data.dict(exclude_unset=True).items():
            if value is not None:
                setattr(db_template, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_template)
            return db_template
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Failed to update template")

    def delete_template(self, template_id: int) -> TransactionTemplate:
        """Soft-delete: sets deleted_at timestamp instead of removing the row."""
        db_template = self.get_template(template_id)
        if not db_template:
            raise HTTPException(status_code=404, detail="Template not found")

        db_template.deleted_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def list_permissions(self, template_id: int) -> tp.PermissionsResponse:
        _ = self.get_template(template_id)
        if _ is None:
            raise HTTPException(status_code=404, detail="Template not found")

        user_rows = (
            self.db.query(TransactionTemplateUserPermission)
            .filter(TransactionTemplateUserPermission.template_id == template_id)
            .all()
        )
        role_rows = (
            self.db.query(TransactionTemplateRolePermission)
            .filter(TransactionTemplateRolePermission.template_id == template_id)
            .all()
        )

        return tp.PermissionsResponse(
            template_id=template_id,
            user_subs=sorted({row.user_sub for row in user_rows}),
            role_names=sorted({row.role_name for row in role_rows}),
        )

    def add_user_permission(
        self, template_id: int, payload: tp.UserPermissionCreate
    ) -> tp.PermissionsResponse:
        _ = self.get_template(template_id)
        if _ is None:
            raise HTTPException(status_code=404, detail="Template not found")

        user_sub = payload.user_sub.strip()
        if not user_sub:
            raise HTTPException(status_code=400, detail="user_sub is required")

        row = TransactionTemplateUserPermission(
            template_id=template_id,
            user_sub=user_sub,
        )
        try:
            self.db.add(row)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()

        return self.list_permissions(template_id)

    def remove_user_permission(
        self, template_id: int, user_sub: str
    ) -> tp.PermissionsResponse:
        _ = self.get_template(template_id)
        if _ is None:
            raise HTTPException(status_code=404, detail="Template not found")

        cleaned = user_sub.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="user_sub is required")

        (
            self.db.query(TransactionTemplateUserPermission)
            .filter(
                TransactionTemplateUserPermission.template_id == template_id,
                TransactionTemplateUserPermission.user_sub == cleaned,
            )
            .delete()
        )
        self.db.commit()
        return self.list_permissions(template_id)

    def add_role_permission(
        self, template_id: int, payload: tp.RolePermissionCreate
    ) -> tp.PermissionsResponse:
        _ = self.get_template(template_id)
        if _ is None:
            raise HTTPException(status_code=404, detail="Template not found")

        role_name = payload.role_name.strip()
        if not role_name:
            raise HTTPException(status_code=400, detail="role_name is required")

        row = TransactionTemplateRolePermission(
            template_id=template_id,
            role_name=role_name,
        )
        try:
            self.db.add(row)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()

        return self.list_permissions(template_id)

    def remove_role_permission(
        self, template_id: int, role_name: str
    ) -> tp.PermissionsResponse:
        _ = self.get_template(template_id)
        if _ is None:
            raise HTTPException(status_code=404, detail="Template not found")

        cleaned = role_name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="role_name is required")

        (
            self.db.query(TransactionTemplateRolePermission)
            .filter(
                TransactionTemplateRolePermission.template_id == template_id,
                TransactionTemplateRolePermission.role_name == cleaned,
            )
            .delete()
        )
        self.db.commit()
        return self.list_permissions(template_id)

    def can_execute_template(
        self, template_id: int, user_info: dict, bypass_role: str
    ) -> bool:
        template = self.get_template(template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")

        user_roles = set(user_info.get("realm_access", {}).get("roles", []))
        if bypass_role in user_roles:
            return True

        user_sub = str(user_info.get("sub") or "").strip()
        if not user_sub and user_info.get("user_id"):
            user_sub = str(user_info.get("user_id")).strip()
        if not user_sub:
            return False

        user_permission_exists = (
            self.db.query(TransactionTemplateUserPermission.id)
            .filter(
                TransactionTemplateUserPermission.template_id == template_id,
                TransactionTemplateUserPermission.user_sub == user_sub,
            )
            .first()
            is not None
        )
        if user_permission_exists:
            return True

        if not user_roles:
            return False

        role_permission_exists = (
            self.db.query(TransactionTemplateRolePermission.id)
            .filter(
                TransactionTemplateRolePermission.template_id == template_id,
                TransactionTemplateRolePermission.role_name.in_(user_roles),
            )
            .first()
            is not None
        )
        return role_permission_exists
