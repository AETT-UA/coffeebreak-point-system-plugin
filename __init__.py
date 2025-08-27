from utils.api import Router
from .routes import router
from .schemas.qrcode_component import QrCode
from services.component_registry import ComponentRegistry

import logging
loger = logging.getLogger("coffeebreak.point_system")

def register_plugin():
    # Register UI components
    ComponentRegistry.register_component(QrCode)
    loger.debug("Point System plugin registered.")


def unregister_plugin():
    # Unregister UI components
    ComponentRegistry.unregister_component("QrCode")
    loger.debug("Point System plugin unregistered.")


REGISTER = register_plugin
UNREGISTER = unregister_plugin

NAME = "point-system"
DESCRIPTION = "Integration with the point system"

CONFIG_PAGE = True
