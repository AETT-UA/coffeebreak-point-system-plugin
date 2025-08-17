from typing import List, Optional           # type: ignore
from sqlalchemy.orm import Session          # type: ignore
from sqlalchemy.exc import IntegrityError   # type: ignore
from utils.api import HTTPException         # type: ignore

from ..models.transaction_template import TransactionTemplate
from ..schemas import transaction_template as tp

class TransactionTemplateService:
    def __init__(self, db:Session):
        self.db:Session = db

    def create_template(self, template: TransactionTemplate) -> Optional[TransactionTemplate]:
        """
        Create a new transaction template

        Args:
            template: Template data to create

        Returns:
            Created template

        Raises:
            HTTPException: If template with same name already exists
        """
        def fail():
            raise HTTPException(
                status_code=400,
                detail="Template with this name already exists"
            )
        
        # check if a template with the same name already exists
        # This prevents the id to increase unnecessarily
        existing_template = self.db.query(TransactionTemplate).filter(
                TransactionTemplate.name == template.name
            ).first()
        
        if existing_template:
            fail()
            
        template_data = {k: v for k, v in template.__dict__.items() if v is not None}
        db_template = TransactionTemplate(**template_data)
        
        try:
            self.db.add(db_template)
            self.db.commit()
            self.db.refresh(db_template)
            return db_template
        except IntegrityError:
            self.db.rollback()
            fail()

    def list_templates(self) -> List[TransactionTemplate]:
        """
        List all transaction templates

        Returns:
            List of templates
        """
        return self.db.query(TransactionTemplate).all()

    def get_template(self, template_id: int) -> Optional[TransactionTemplate]:
        """
        Get a specific template by ID

        Args:
            template_id: ID of the template to retrieve

        Returns:
            Template if found, None otherwise
        """
        return self.db.query(TransactionTemplate).filter(TransactionTemplate.id == template_id).first()

    def update_template(self, template_id: int, template_data: tp.Update) -> Optional[TransactionTemplate]:
        """
        Update an existing transaction template
        Args:
            template_id: ID of the template to update
            template_data: Data to update the template with
        Returns:
            Updated template if found, None otherwise
        """
        db_template = self.get_template(template_id)
        if not db_template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Update only the fields that are provided in the template_data
        for key, value in template_data.dict().items():
            if value is not None:
                setattr(db_template, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_template)
            return db_template
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Template with this name already exists"
            )
