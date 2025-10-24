from coffeebreak.utils.api import Router
from .transaction_template import router as transaction_template_router

router = Router()
router.include_router(transaction_template_router, "/transaction-template")