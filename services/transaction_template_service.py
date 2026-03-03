from datetime import datetime, timezone
import logging
from typing import List, Optional

from coffeebreak.utils.api import HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.transaction_template import TransactionTemplate
from ..models.transaction_template_qr_claim import TransactionTemplateQrClaim
from ..models.transaction_template_permission import (
    TransactionTemplateUserPermission,
    TransactionTemplateRolePermission,
)
from ..schemas import transaction_template as tp


logger = logging.getLogger("coffeebreak.point_system")


class TransactionTemplateService:
    _schema_ready = False

    def __init__(self, db: Session):
        self.db: Session = db
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        if TransactionTemplateService._schema_ready:
            return

        bind = self.db.get_bind()
        inspector = inspect(bind)

        def ensure_column(column_name: str, ddl: str) -> None:
            current_columns = {
                column["name"]
                for column in inspect(bind).get_columns("transaction_templates")
            }
            if column_name in current_columns:
                return

            try:
                self.db.execute(text(ddl))
                self.db.commit()
            except Exception:
                self.db.rollback()
                refreshed_columns = {
                    column["name"]
                    for column in inspect(bind).get_columns("transaction_templates")
                }
                if column_name not in refreshed_columns:
                    logger.exception(
                        "Failed adding column '%s' to transaction_templates",
                        column_name,
                    )
                    raise

        if "transaction_templates" in inspector.get_table_names():
            ensure_column(
                "qr_enabled",
                "ALTER TABLE transaction_templates "
                "ADD COLUMN qr_enabled BOOLEAN NOT NULL DEFAULT false",
            )
            ensure_column(
                "points_mode",
                "ALTER TABLE transaction_templates "
                "ADD COLUMN points_mode VARCHAR(32) NOT NULL DEFAULT 'automatic'",
            )
            ensure_column(
                "claim_limit_mode",
                "ALTER TABLE transaction_templates "
                "ADD COLUMN claim_limit_mode VARCHAR(32) NOT NULL DEFAULT 'per_user'",
            )

        TransactionTemplateQrClaim.__table__.create(bind=bind, checkfirst=True)
        TransactionTemplateService._schema_ready = True

    def _active_query(self):
        return self.db.query(TransactionTemplate).filter(
            TransactionTemplate.deleted_at.is_(None)
        )

    @staticmethod
    def _normalize_points_mode(value) -> str:
        if value is None:
            return "automatic"

        if hasattr(value, "value"):
            value = value.value

        mode = str(value).strip().lower()
        if mode in {"automatic", "manual"}:
            return mode

        raise HTTPException(
            status_code=422,
            detail="points_mode must be either 'automatic' or 'manual'.",
        )

    @staticmethod
    def _normalize_claim_limit_mode(value) -> str:
        if value is None:
            return "per_user"

        if hasattr(value, "value"):
            value = value.value

        mode = str(value).strip().lower()
        if mode in {"per_user", "overall"}:
            return mode

        raise HTTPException(
            status_code=422,
            detail="claim_limit_mode must be either 'per_user' or 'overall'.",
        )

    @staticmethod
    def _normalize_claim_limit(value) -> int:
        if value is None:
            return 0

        try:
            normalized = int(value)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Invalid claim_limit '{value}'. "
                    "Use 0 for unlimited or a positive integer."
                ),
            )

        if normalized < 0:
            raise HTTPException(
                status_code=422, detail="claim_limit cannot be negative."
            )

        return normalized

    @staticmethod
    def _normalize_qr_enabled(value) -> bool:
        if isinstance(value, bool):
            return value

        if value is None:
            return False

        if isinstance(value, (int, float)):
            return bool(value)

        lowered = str(value).strip().lower()
        if lowered in {"true", "1", "yes", "y", "on"}:
            return True
        if lowered in {"false", "0", "no", "n", "off", ""}:
            return False

        raise HTTPException(status_code=422, detail="qr_enabled must be a boolean.")

    @staticmethod
    def _round_points(value) -> int:
        numeric = float(value)
        if numeric >= 0:
            return int(numeric + 0.5)
        return int(numeric - 0.5)

    @classmethod
    def _validate_template_points_mode(cls, points_mode: str, points: int):
        if points_mode == "automatic" and points <= 0:
            raise HTTPException(
                status_code=422,
                detail="Automatic templates require points greater than zero.",
            )

        if points_mode == "manual" and points < 0:
            raise HTTPException(
                status_code=422,
                detail="Manual templates require points to be zero or greater.",
            )

    def create_template(self, template: tp.Base) -> TransactionTemplate:
        template_data = {k: v for k, v in template.dict().items() if v is not None}
        points_mode = self._normalize_points_mode(template_data.get("points_mode"))
        points_value = self._round_points(template_data.get("points", 0))

        self._validate_template_points_mode(points_mode, points_value)

        template_data["points_mode"] = points_mode
        template_data["points"] = points_value
        template_data["qr_enabled"] = self._normalize_qr_enabled(
            template_data.get("qr_enabled")
        )
        template_data["claim_limit"] = self._normalize_claim_limit(
            template_data.get("claim_limit")
        )
        template_data["claim_limit_mode"] = self._normalize_claim_limit_mode(
            template_data.get("claim_limit_mode")
        )

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

        points_mode = self._normalize_points_mode(
            getattr(db_template, "points_mode", None)
        )
        points_value = self._round_points(getattr(db_template, "points", 0))
        self._validate_template_points_mode(points_mode, points_value)

        db_template.points_mode = points_mode
        db_template.points = points_value
        db_template.qr_enabled = self._normalize_qr_enabled(
            getattr(db_template, "qr_enabled", False)
        )
        db_template.claim_limit = self._normalize_claim_limit(
            getattr(db_template, "claim_limit", 0)
        )
        db_template.claim_limit_mode = self._normalize_claim_limit_mode(
            getattr(db_template, "claim_limit_mode", "per_user")
        )

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

    def count_qr_claims_for_user(self, template_id: int, user_sub: str) -> int:
        return (
            self.db.query(TransactionTemplateQrClaim.id)
            .filter(
                TransactionTemplateQrClaim.template_id == template_id,
                TransactionTemplateQrClaim.user_sub == user_sub,
            )
            .count()
        )

    def count_qr_claims_overall(self, template_id: int) -> int:
        return (
            self.db.query(TransactionTemplateQrClaim.id)
            .filter(TransactionTemplateQrClaim.template_id == template_id)
            .count()
        )

    def ensure_claim_limit_available(
        self, template: TransactionTemplate, user_id: str
    ) -> None:
        claim_limit = self._normalize_claim_limit(getattr(template, "claim_limit", 0))
        if claim_limit <= 0:
            return

        claim_limit_mode = self._normalize_claim_limit_mode(
            getattr(template, "claim_limit_mode", "per_user")
        )

        if claim_limit_mode == "overall":
            claims_count = self.count_qr_claims_overall(template.id)
            if claims_count >= claim_limit:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Claim limit reached for template '{template.name}'. "
                        f"This template allows at most {claim_limit} claims in total."
                    ),
                )
            return

        claims_count = self.count_qr_claims_for_user(template.id, user_id)
        if claims_count >= claim_limit:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Claim limit reached for template '{template.name}'. "
                    f"You can claim it at most {claim_limit} times."
                ),
            )

    def record_template_claim(
        self,
        template_id: int,
        user_id: str,
        point_transaction_id: Optional[int],
    ) -> None:
        self.register_qr_claim(
            template_id=template_id,
            user_sub=user_id,
            transaction_id=point_transaction_id,
        )

    def register_qr_claim(
        self, template_id: int, user_sub: str, transaction_id: Optional[int] = None
    ) -> TransactionTemplateQrClaim:
        claim = TransactionTemplateQrClaim(
            template_id=template_id,
            user_sub=user_sub,
            transaction_id=transaction_id,
        )
        self.db.add(claim)
        self.db.commit()
        self.db.refresh(claim)
        return claim
