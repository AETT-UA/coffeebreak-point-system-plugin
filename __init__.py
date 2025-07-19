from utils.api import Router
from .routes import router


def register_plugin():
    # Register UI components
    pass


def unregister_plugin():
    # Unregister UI components
    pass


REGISTER = register_plugin
UNREGISTER = unregister_plugin

NAME = "point-system"
DESCRIPTION = "Integration with the point system"

CONFIG_PAGE = True
