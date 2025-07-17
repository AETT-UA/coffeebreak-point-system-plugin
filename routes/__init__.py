from utils.api import Router # type: ignore
from .transaction_template import router as transaction_template_router

router = Router()
router.include_router(transaction_template_router, "/transaction-template")