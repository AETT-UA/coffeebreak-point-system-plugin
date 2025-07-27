from utils.api import Router # type: ignore
from .transaction_template import router as transaction_template_router
from ..tests.router import router as test_router

router = Router()
router.include_router(transaction_template_router, "/transaction-template")


#TODO: remove this after testing
router.include_router(test_router, "/test")
