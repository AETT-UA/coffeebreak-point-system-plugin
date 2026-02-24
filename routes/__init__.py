from coffeebreak.utils.api import Router # type: ignore
from .transaction_template import router as transaction_template_router
from .point_system import router as point_system_router
from ..tests.router import router as test_router

router = Router()
router.include_router(transaction_template_router, "/transaction-template")
router.include_router(point_system_router, "/point-system")


#TODO: remove this after testing
router.include_router(test_router, "/test")
