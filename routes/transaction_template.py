from utils.api import Router # type: ignore

router = Router()

## TODO: Implement transaction template endpoints
@router.get("/example")
async def get_example_transaction_template():
    return "Example transaction template"